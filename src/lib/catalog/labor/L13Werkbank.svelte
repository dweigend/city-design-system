<script lang="ts">
	import { Checkbox, RadioGroup, Select } from 'bits-ui';
	import { Check } from 'lucide-svelte';
	import ChoiceControl from './ChoiceControl.svelte';
	import Button from '../ui/Button.svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import Regler from '../werkbank/Regler.svelte';
	import WerkbankView from '../werkbank/WerkbankView.svelte';
	import { modulNamen } from '../werkbank/modulNamen';
	import {
		bewegungen,
		hausAnsichten,
		werkbankHinweis,
		type HausAnsichtId
	} from '../data/interface';
	import { flows, flowColor, type FlowId } from '../data/focus';
	import {
		bauphasen,
		fokusArten,
		schichtLabels,
		transparenzStufen,
		werkbankSzenen
	} from '../data/werkbank';
	import { werkbankSzene, type WerkbankSzene } from '../logic/ansicht/szenen';
	import { schichten, tagAll, tagFor, quelle, type Schicht } from '../logic/ansicht/tags';
	import { auswahlKey, type FokusArt, type Transparenz } from '../logic/ansicht/fokus';
	import { gruppen, versatz } from '../logic/ansicht/explosion';
	import { eyes } from '../logic/ansicht/rahmen';
	import {
		ansichten,
		auswahlInfo,
		builtBounds,
		explodedBounds,
		schnittHoehe,
		subjectBounds,
		type Achse
	} from '../logic/ansicht/werkbank';
	import type { SceneStyle } from '../logic/parametrik/style';
	import type { Primitive } from '../logic/parametrik/types';

	/**
	 * Workbench: open a building. Image on the left (main view, below it top view and section),
	 * controls on the right in the DemoLayout. The main choice is the building view (Exterior, X-Ray, Section,
	 * Exploded View, Floor Plan); it sets focus, section and explosion. The groups below
	 * adjust the same quantities one by one. Below the image it says what the view shows.
	 */
	let { id = 'werkbank' }: { id?: string } = $props();

	let szene = $state<WerkbankSzene>('geruestturm'),
		ansicht = $state<HausAnsichtId>('aussen'),
		art = $state<FokusArt>('alle'),
		strom = $state<FlowId>('people'),
		geschoss = $state('1'),
		schicht = $state<Schicht>('netz'),
		sichtbar = $state<Schicht[]>([...schichten]),
		transparenz = $state(0),
		ebenen = $state(0),
		module = $state(0),
		zeit = $state(4),
		horizontal = $state(false),
		vertikal = $state(false),
		achse = $state<Achse>('x'),
		lage = $state(0),
		auswahl = $state<string | undefined>(undefined),
		offen = $state('haus');
	let hauptansicht = $state<WerkbankView>();

	const base = $derived(werkbankSzene(szene));
	const tags = $derived(tagAll(base));
	const built = $derived(builtBounds(base, tags));
	const levels = $derived(
		[...new Set([...tags.values()].map((t) => t.level))].filter((l) => l >= 0).sort((a, b) => a - b)
	);
	// Position of the section plane: on a change of scene or axis, through the middle of the new addition.
	const subject = $derived(subjectBounds(base, tags));
	$effect(() => {
		const i = achse === 'x' ? 0 : 1;
		lage = Math.round(((subject.min[i] + subject.max[i]) / 2) * 2) / 2;
	});
	const range = $derived(
		achse === 'x' ? [built.min[0], built.max[0]] : [built.min[1], built.max[1]]
	);
	const darstellung = $derived({
		fokus: {
			art,
			strom,
			ebene: Number(geschoss),
			schicht,
			auswahl
		},
		transparenz: transparenz as Transparenz,
		sichtbar: new Set<Schicht>(['boden', ...sichtbar]),
		// Material changes only at whole phases; in between only the group moves.
		zeit: Math.floor(zeit + 1e-6)
	});
	const views = $derived(
		ansichten(
			base,
			tags,
			darstellung,
			{ horizontal, vertikal, geschoss: Number(geschoss), achse, lage },
			built
		)
	);
	const groups = $derived(gruppen(base, tags));
	const offsets = $derived(
		versatz(groups, { ebenen, module }, zeit, [
			(built.min[0] + built.max[0]) / 2,
			(built.min[1] + built.max[1]) / 2
		])
	);
	const groupOf = $derived((p: Primitive) => tagFor(tags, p).group);
	// Framing: the main view grows with the explosion, plan and section show what is built.
	const top = $derived(Math.max(0, ...levels));
	const mainFrame = $derived.by(() => {
		// Floor section: the frame ends at the cut height, the floor fills the image.
		const cut = horizontal ? schnittHoehe(Number(geschoss)) : Infinity;
		const b = { min: built.min, max: [built.max[0], built.max[1], Math.min(built.max[2], cut)] };
		return explodedBounds(b as typeof built, ebenen, module, horizontal ? Number(geschoss) : top);
	});
	const pad = (b: typeof built, m: number, depth = 0): typeof built => ({
		min: [b.min[0] - m, b.min[1] - m, b.min[2] - depth],
		max: [b.max[0] + m, b.max[1] + m, b.max[2] + 1]
	});
	const planFrame = $derived(pad(built, 2.5));
	const sectionFrame = $derived(pad(built, 2, 3.4));
	const info = $derived(auswahlInfo(base, tags, auswahl));
	/**
	 * Selectable modules with readable names: layer, flow, floor; equal names get a
	 * number. The internal key (auswahlKey) stays a value only, never text.
	 */
	const module_ = $derived(modulNamen(tags.values()));
	const auswahlName = $derived(module_.find((m) => m.value === auswahl)?.label);
	const style: SceneStyle = {
		level: 'detail',
		lines: true,
		material: 'flat',
		existing: false,
		materials: true
	};

	function pick(hit: string | undefined) {
		const t = hit ? tags.get(quelle(hit)) : undefined;
		const key = t && t.schicht !== 'boden' ? auswahlKey(t) : undefined;
		auswahl = key === auswahl ? undefined : key;
	}
	function scene(next: string) {
		szene = next as WerkbankSzene;
		auswahl = undefined;
	}
	/** Smooth animation of a slider (rAF, ease-out); runs only while the page is visible. */
	let running: number | undefined;
	function animate(set: (v: number) => void, from: number, to: number, ms: number) {
		if (running) cancelAnimationFrame(running);
		const t0 = performance.now();
		const step = (now: number) => {
			const k = Math.min(1, (now - t0) / ms);
			set(from + (to - from) * (1 - (1 - k) ** 3));
			running = k < 1 ? requestAnimationFrame(step) : undefined;
		};
		running = requestAnimationFrame(step);
	}
	const exploded = $derived(ebenen > 0.1 || module > 0.02);
	function toggleExplosion() {
		explodiere(...((exploded ? [0, 0] : [4, 0.35]) as [number, number]));
	}
	/** Ease the explosion to target values (levels in meters, modules as a share). */
	function explodiere(e1: number, m1: number) {
		const [e0, m0] = [ebenen, module];
		if (e0 === e1 && m0 === m1) return;
		animate(
			(k) => {
				ebenen = e0 + (e1 - e0) * k;
				module = m0 + (m1 - m0) * k;
			},
			0,
			1,
			900
		);
	}
	/** Between two phases the slider shows the phase that is just arriving. */
	const phaseLabel = (v: number) => {
		const k = Math.min(4, Math.max(0, Math.ceil(v - 1e-3)));
		return `${k} · ${bauphasen[k]}`;
	};
	function playPhases() {
		animate((v) => (zeit = v), 0, 4, 4200);
	}
	/** Choose a building view: sets focus, section and explosion to their starting state. */
	function setzeAnsicht(v: string) {
		ansicht = v as HausAnsichtId;
		const mitte = levels[Math.floor(levels.length / 2)] ?? 0;
		horizontal = ansicht === 'geschoss';
		vertikal = ansicht === 'schnitt';
		transparenz = ansicht === 'roentgen' || ansicht === 'geschoss' ? 1 : 0;
		art = ansicht === 'roentgen' ? 'schicht' : ansicht === 'geschoss' ? 'ebene' : 'alle';
		if (ansicht === 'roentgen') schicht = 'modul';
		if (ansicht === 'geschoss') geschoss = String(mitte);
		if (ansicht === 'explosion') explodiere(4, 0);
		else explodiere(0, 0);
	}
	const aktuell = $derived(hausAnsichten.find((a) => a.id === ansicht) ?? hausAnsichten[0]);
	const ansichtItems = hausAnsichten.map((a) => ({ value: a.id, label: a.name }));

	function zuruecksetzen() {
		if (running) cancelAnimationFrame(running);
		running = undefined;
		szene = 'geruestturm';
		auswahl = undefined;
		strom = 'people';
		schicht = 'netz';
		sichtbar = [...schichten];
		zeit = 4;
		achse = 'x';
		ebenen = 0;
		module = 0;
		setzeAnsicht('aussen');
		offen = 'haus';
		hauptansicht?.zuruecksetzen();
	}
	function toggle(s: Schicht, on: boolean) {
		sichtbar = on ? [...sichtbar, s] : sichtbar.filter((x) => x !== s);
	}
	const flowItems = flows.map((f) => ({ value: f.id, label: f.name }));
	const levelItems = $derived(levels.map((l) => ({ value: String(l), label: String(l) })));
	const planNote = $derived(`Floor ${geschoss}`);
	const schnittName = $derived(achse === 'x' ? 'A–A' : 'B–B');
</script>

<DemoLayout label="Workbench" onreset={zuruecksetzen} bind:offen>
	{#snippet bild()}
		<div class="stage">
			<div class="main">
				<WerkbankView
					bind:this={hauptansicht}
					primitives={views.haupt}
					{style}
					frame={mainFrame}
					eye={ansicht === 'geschoss' ? eyes.plan : eyes.iso}
					title={aktuell.name}
					label="Workbench, main view {aktuell.name}. Drag to rotate, click to select a module."
					{groupOf}
					{offsets}
					interactive
					onpick={pick}
				/>
			</div>
			<div class="klein">
				<WerkbankView
					primitives={views.plan}
					{style}
					frame={planFrame}
					eye={eyes.plan}
					title="Top view"
					note={planNote}
					label="Workbench top view, floor plan of the selected floor. Click to select a module."
					onpick={pick}
				/>
				<WerkbankView
					primitives={views.schnitt}
					{style}
					frame={sectionFrame}
					eye={achse === 'x' ? eyes['schnitt-x'] : eyes['schnitt-y']}
					title="Section {schnittName}"
					label="Workbench section with subsoil. Click to select a module."
					onpick={pick}
				/>
			</div>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="haus" titel="Open a building">
			<ChoiceControl
				id="{id}-szene"
				label="Building"
				bind:value={() => szene, scene}
				items={werkbankSzenen}
			/>
			<ChoiceControl
				id="{id}-ansicht"
				label="View"
				bind:value={() => ansicht, setzeAnsicht}
				items={ansichtItems}
			/>
			<p class="befund" aria-live="polite">{aktuell.wann}</p>
		</Steuergruppe>
		<Steuergruppe wert="fokus" titel="Focus and levels">
			<ChoiceControl
				id="{id}-art"
				label="In focus"
				bind:value={() => art, (v) => (art = v as FokusArt)}
				items={fokusArten}
			/>
			{#if art === 'strom'}
				<RadioGroup.Root
					bind:value={() => strom, (v) => (strom = v as FlowId)}
					class="cg-wb-stroeme"
					aria-label="Flow"
				>
					{#each flowItems as f (f.value)}<RadioGroup.Item value={f.value} class="cg-wb-strom"
							><span class="dot" style:background={flowColor(f.value)}
							></span>{f.label}</RadioGroup.Item
						>{/each}
				</RadioGroup.Root>
			{:else if art === 'ebene'}
				<ChoiceControl id="{id}-ebene" label="Floor" bind:value={geschoss} items={levelItems} />
			{:else if art === 'schicht'}
				<ChoiceControl
					id="{id}-schicht"
					label="Layer"
					bind:value={() => schicht, (v) => (schicht = v as Schicht)}
					items={schichtLabels}
				/>
			{/if}
			<Regler
				label="Transparency"
				bind:value={transparenz}
				min={0}
				max={2}
				step={1}
				format={(v) => transparenzStufen[Math.round(v)]}
			/>
			<fieldset class="chips">
				<legend>Visible layers</legend>
				{#each schichtLabels as s (s.value)}<Checkbox.Root
						class="cg-wb-chip"
						checked={sichtbar.includes(s.value)}
						onCheckedChange={(on) => toggle(s.value, on)}
						>{#snippet children({ checked })}<span class="box" aria-hidden="true"
								>{#if checked}<Check size={10} />{/if}</span
							>{s.label}{/snippet}</Checkbox.Root
					>{/each}
			</fieldset>
		</Steuergruppe>
		<Steuergruppe wert="schnitt" titel="Section and floor plan">
			<ChoiceControl
				id="{id}-geschoss"
				label="Floor in the floor plan"
				bind:value={geschoss}
				items={levelItems}
			/>
			<ChoiceControl
				id="{id}-achse"
				label="Vertical section"
				bind:value={() => achse, (v) => (achse = v as Achse)}
				items={[
					{ value: 'x', label: 'A–A transverse' },
					{ value: 'y', label: 'B–B longitudinal' }
				]}
			/>
			<Regler
				label="Position {schnittName}"
				bind:value={lage}
				min={Math.floor(range[0])}
				max={Math.ceil(range[1])}
				step={0.5}
				format={(v) => `${v.toFixed(1)} m`}
			/>
			<div class="chips">
				<Checkbox.Root class="cg-wb-chip" bind:checked={horizontal}
					>{#snippet children({ checked })}<span class="box" aria-hidden="true"
							>{#if checked}<Check size={10} />{/if}</span
						>Cut open the floor in the building{/snippet}</Checkbox.Root
				>
				<Checkbox.Root class="cg-wb-chip" bind:checked={vertikal}
					>{#snippet children({ checked })}<span class="box" aria-hidden="true"
							>{#if checked}<Check size={10} />{/if}</span
						>Show the section in the building{/snippet}</Checkbox.Root
				>
			</div>
		</Steuergruppe>
		<Steuergruppe wert="bewegung" titel="Explosion and construction phases">
			<div class="regel">
				<Regler
					label="Floors apart"
					bind:value={ebenen}
					min={0}
					max={6}
					step={0.1}
					format={(v) => `${v.toFixed(1)} m`}
				/>
				<p>{bewegungen.explodieren}</p>
			</div>
			<div class="regel">
				<Regler
					label="Push modules out"
					bind:value={module}
					min={0}
					max={0.6}
					step={0.01}
					format={(v) => `${Math.round(v * 100)} %`}
				/>
				<p>{bewegungen.verschieben}</p>
			</div>
			<Button
				variant="secondary"
				label={exploded ? 'Assemble' : 'Pull apart'}
				onclick={toggleExplosion}
			/>
			<div class="regel">
				<Regler
					label="Construction phase"
					bind:value={zeit}
					min={0}
					max={4}
					step={0.01}
					format={phaseLabel}
				/>
				<p>{bewegungen.wachsen}</p>
			</div>
			<Button variant="secondary" label="Play construction sequence" onclick={playPhases} />
		</Steuergruppe>
		<Steuergruppe wert="auswahl" titel="Select a module">
			<Select.Root
				type="single"
				value={auswahl ?? ''}
				onValueChange={(v) => (auswahl = v || undefined)}
			>
				<Select.Trigger class="cg-wb-trigger" aria-label="Select a module"
					>{auswahlName ?? 'No module selected'}</Select.Trigger
				>
				<Select.Portal
					><Select.Content class="werkbank-options" sideOffset={4}>
						{#each module_ as m (m.value)}<Select.Item value={m.value} label={m.label}
								>{m.label}</Select.Item
							>{/each}
					</Select.Content></Select.Portal
				>
			</Select.Root>
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p aria-live="polite">
			<b>{aktuell.name}.</b>
			{aktuell.zeigt}{#if info}
				Selected: {auswahlName ?? info.titel}.{/if}
		</p>
		<p>{werkbankHinweis}</p>
	{/snippet}
</DemoLayout>

<style>
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3);
		min-width: 0;
	}
	.main {
		grid-column: 1 / -1;
		aspect-ratio: 16 / 11;
		min-width: 0;
	}
	.klein {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3);
	}
	.klein > :global(*) {
		aspect-ratio: 4 / 3;
		height: auto;
	}
	.befund,
	.regel p {
		font-size: var(--text-s);
		line-height: 1.45;
		color: var(--ink-2);
	}
	.regel {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	:global(.cg-wb-stroeme) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-1);
	}
	:global(.cg-wb-strom),
	:global(.cg-wb-chip) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 32px;
		padding: 0 var(--space-2);
		font: inherit;
		font-size: var(--text-s);
		color: var(--ink-2);
		background: none;
		border: 0;
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		text-align: left;
		cursor: pointer;
	}
	:global(.cg-wb-strom[data-state='checked']),
	:global(.cg-wb-chip[data-state='checked']) {
		color: var(--ink);
		box-shadow: inset 0 0 0 var(--hair) var(--ink);
	}
	:global(.cg-wb-strom:focus-visible),
	:global(.cg-wb-chip:focus-visible),
	:global(.cg-wb-trigger:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0 0 var(--space-2);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.box {
		display: inline-grid;
		place-items: center;
		width: 12px;
		height: 12px;
		border: var(--hair) solid currentColor;
	}
	:global(.cg-wb-trigger) {
		width: 100%;
		min-height: 36px;
		padding: 0 var(--space-3);
		font: inherit;
		font-size: var(--text-s);
		text-align: left;
		color: var(--ink);
		background: var(--paper);
		border: var(--hair) solid var(--line);
		cursor: pointer;
	}
	:global(.werkbank-options) {
		max-height: 280px;
		max-width: calc(100vw - 32px);
		overflow: auto;
		background: var(--paper);
		color: var(--ink);
		border: var(--hair) solid var(--line);
		font-size: var(--text-s);
		z-index: 50;
	}
	:global(.werkbank-options [role='option']) {
		padding: var(--space-2);
		cursor: pointer;
	}
	:global(.werkbank-options [data-highlighted]) {
		background: var(--ink);
		color: var(--paper);
	}
	/* Mobile: main view fixed at the top (DemoLayout), top view and section are dropped; section and
	   floor are shown by the main view itself. */
	@media (max-width: 960px) {
		.main {
			aspect-ratio: auto;
			height: 45svh;
		}
		.klein {
			display: none;
		}
		:global(.cg-wb-strom),
		:global(.cg-wb-chip) {
			min-height: 44px;
		}
	}
</style>
