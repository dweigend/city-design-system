<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { KERN_AN, KERN_AUS } from '../logic/parametrik/welt/typen';
	let kern = $state(false);
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import ChoiceControl from './ChoiceControl.svelte';
	import WeltView from '../scene/WeltView.svelte';
	import Scale from '../ui/Scale.svelte';
	import Button from '../ui/Button.svelte';
	import Switch from '../ui/Switch.svelte';
	import {
		farbcodes,
		fokusse,
		rasterarten,
		welt,
		weltDefaults,
		type FarbcodeId,
		type FokusId,
		type RasterId,
		type WeltParams
	} from '../logic/parametrik/welt';
	import {
		ansichten,
		ebenen,
		kreislaeufe,
		type Ansicht,
		type Ebene
	} from '../logic/parametrik/welt/ansicht';
	import { farbcodeNamen, voreinstellungen as vorgaben } from '../data/labor';

	type Voreinstellung = {
		id: string;
		name: string;
		text: string;
		welt: Partial<WeltParams>;
		ansicht?: Ansicht;
		glas?: boolean;
		/** The walkthrough starts on its own. */
		abspielen?: boolean;
	};
	const voreinstellungen = vorgaben satisfies Voreinstellung[];

	/**
	 * Full simulation: grid, existing stock, interventions, elevated walkways and cycles in one world.
	 * Presets as a strip directly above the image; one is marked as long as all sliders
	 * match its values. Controls in groups, the view group is open.
	 * `zahlen`: metrics line below the image, only in the Lab, not on chapter pages.
	 */
	let { zahlen = true }: { zahlen?: boolean } = $props();

	let seed = $state(weltDefaults.seed),
		groesse = $state(weltDefaults.groesse),
		dichte = $state(weltDefaults.dichte),
		hoehe = $state(weltDefaults.hoehe),
		schwamm = $state(weltDefaults.schwamm),
		farbcode = $state<string>(weltDefaults.farbcode),
		fokus = $state<string>(weltDefaults.fokus),
		raster = $state<string>(weltDefaults.raster),
		mass = $state(weltDefaults.mass),
		verzug = $state(weltDefaults.verzug),
		relax = $state(weltDefaults.relax),
		ansicht = $state<string>('plan'),
		ebene = $state<string>('boden'),
		glas = $state(false),
		tour = $state(0),
		laeuft = $state(false),
		offen = $state('ansicht');
	let view = $state<ReturnType<typeof WeltView>>();
	let host: HTMLDivElement;

	const params = $derived<WeltParams>({
		seed,
		groesse,
		dichte,
		hoehe,
		schwamm,
		farbcode: farbcode as FarbcodeId,
		fokus: fokus as FokusId,
		raster: raster as RasterId,
		mass,
		verzug,
		relax,
		kern: kern ? KERN_AN : KERN_AUS
	});
	const world = $derived(welt(params));
	const anteil = (v: number) => `${Math.round(v * 100)} %`;
	const art = $derived(rasterarten.find((r) => r.id === raster) ?? rasterarten[0]);
	const hilfe = $derived(ansichten.find((a) => a.value === ansicht)?.hilfe ?? '');

	/** The marked preset is the one whose values all apply; otherwise none. */
	function gilt(v: Voreinstellung) {
		const soll = { ...weltDefaults, ...v.welt };
		return (
			(Object.keys(soll) as (keyof WeltParams)[]).every((k) => soll[k] === params[k]) &&
			(v.ansicht ?? 'plan') === ansicht &&
			(v.glas ?? false) === glas
		);
	}
	const aktiv = $derived(voreinstellungen.find(gilt));

	/** Apply a preset: first the defaults, then its values. Public for the principles. */
	export function waehle(id: string, zeigen = false) {
		const v = voreinstellungen.find((x) => x.id === id);
		if (!v) return;
		const p = { ...weltDefaults, ...v.welt };
		seed = p.seed;
		groesse = p.groesse;
		dichte = p.dichte;
		hoehe = p.hoehe;
		schwamm = p.schwamm;
		farbcode = p.farbcode;
		fokus = p.fokus;
		raster = p.raster;
		mass = p.mass;
		verzug = p.verzug;
		relax = p.relax;
		kern = p.kern === KERN_AN;
		ansicht = v.ansicht ?? 'plan';
		glas = v.glas ?? false;
		tour = 0;
		laeuft = !!v.abspielen;
		if (ansicht === 'plan') view?.reset();
		if (zeigen) host?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Play the walkthrough: one route in about 40 seconds, stop at the end.
	$effect(() => {
		if (!laeuft || ansicht !== 'rundgang') return;
		let frame = 0,
			last = performance.now();
		const tick = (now: number) => {
			tour = Math.min(100, tour + ((now - last) / 1000) * 2.5);
			last = now;
			if (tour >= 100) laeuft = false;
			else frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<DemoLayout label="Full simulation" bind:offen onreset={() => waehle('quartier')}>
	{#snippet bild()}
		<div class="bild" bind:this={host}>
			<RadioGroup.Root
				value={aktiv?.id ?? ''}
				onValueChange={(v) => waehle(v)}
				aria-label="Preset"
				orientation="horizontal"
				class="cg-voreinstellungen"
			>
				{#each voreinstellungen as v (v.id)}
					<RadioGroup.Item value={v.id} class="cg-voreinstellung">{v.name}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
			<WeltView
				bind:this={view}
				{world}
				mode={ansicht as Ansicht}
				ebene={ebene as Ebene}
				{glas}
				tour={tour / 100}
				label="Full simulation: district on existing stock on the {art.name} grid. {hilfe}"
			/>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="ansicht" titel="View">
			<ChoiceControl id="welt-ansicht" label="View" bind:value={ansicht} items={ansichten} />
			{#if ansicht === 'rundgang'}
				<Scale
					label="Walkthrough"
					bind:value={tour}
					min={0}
					max={100}
					step={1}
					format={(v) => `${Math.round(v)} %`}
				/>
				<Button
					variant="secondary"
					label={laeuft ? 'Pause' : 'Play'}
					onclick={() => {
						if (tour >= 100) tour = 0;
						laeuft = !laeuft;
					}}
				/>
			{:else if ansicht === 'gehen'}
				<ChoiceControl id="welt-ebene" label="Level" bind:value={ebene} items={ebenen} />
				<div class="pad">
					<Button variant="secondary" label="Left" onclick={() => view?.step(0, 0.35)} />
					<Button variant="secondary" label="Forward" onclick={() => view?.step(4)} />
					<Button variant="secondary" label="Right" onclick={() => view?.step(0, -0.35)} />
					<Button variant="secondary" label="Back" onclick={() => view?.step(-4)} />
				</div>
			{/if}
			<Switch id="welt-glas" label="Existing stock transparent" bind:checked={glas} />
		</Steuergruppe>
		<Steuergruppe wert="grund" titel="Ground">
			<Switch id="welt-kern" label="Kernel" bind:checked={kern} />
			<ChoiceControl
				id="welt-raster"
				label="Grid"
				bind:value={raster}
				items={rasterarten.map((r) => ({ value: r.id, label: r.name }))}
			/>
			<Scale
				label="District"
				bind:value={groesse}
				min={3}
				max={6}
				step={1}
				format={(v) => `${v} × ${v} blocks`}
			/>
			<Scale
				label="Block size"
				bind:value={mass}
				min={0.8}
				max={1.3}
				step={0.05}
				format={(v) => `${Math.round(v * 30)} m`}
			/>
			<Scale label="Distortion" bind:value={verzug} min={0} max={1} step={0.05} format={anteil} />
			<Scale
				label="Smoothing"
				bind:value={relax}
				min={0}
				max={6}
				step={1}
				format={(v) => (v ? `${v} passes` : 'off')}
			/>
		</Steuergruppe>
		<Steuergruppe wert="eingriffe" titel="Interventions">
			<Scale label="Density" bind:value={dichte} min={0} max={1} step={0.05} format={anteil} />
			<Scale label="Height" bind:value={hoehe} min={0} max={1} step={0.05} format={anteil} />
			<Scale label="Sponge" bind:value={schwamm} min={0} max={1} step={0.05} format={anteil} />
		</Steuergruppe>
		<Steuergruppe wert="farbe" titel="Color and focus">
			<ChoiceControl
				id="welt-farbcode"
				label="Color"
				bind:value={farbcode}
				items={farbcodes.map((f) => ({ value: f.id, label: farbcodeNamen[f.id] ?? f.name }))}
			/>
			<ChoiceControl
				id="welt-fokus"
				label="Focus"
				bind:value={fokus}
				items={fokusse.map((f) => ({ value: f.id, label: f.name }))}
			/>
		</Steuergruppe>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="welt-saat" bind:value={seed} />
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<div class="bilanz" role="group" aria-label="Coverage of the cycles in the district">
			{#each kreislaeufe as k (k.id)}
				<Scale
					mode="readout"
					track="bar"
					label={k.name}
					value={world.bilanz[k.id] * 100}
					format={(v) => `${Math.round(v)} %`}
					detail="{k.name}: {anteil(world.bilanz[k.id])} of demand from the district. {k.quelle}"
				/>
			{/each}
		</div>
		{#if aktiv}<p><b>{aktiv.name}.</b> {aktiv.text}</p>{/if}
		<p>{art.name} grid, blocks of about {Math.round(mass * 30)} m. {hilfe}</p>
		{#if zahlen}
			<p class="zahlen" aria-live="polite">
				{world.zahlen.bloecke} blocks · {world.zahlen.bestand} buildings in existing stock · {world
					.zahlen.eingriffe} interventions · {world.zahlen.hochweg} m elevated walkway on level {world.zahlen.ebenen.join(
					', '
				)} · {world.zahlen.laeufe} runs · {world.zahlen.schleifen} loops · {world.zahlen.dachwege} platforms
				on roofs · {world.zahlen.bewohner} residents · {world.zahlen.zellen} build cells, smallest angle
				{world.zahlen.winkel}°
			</p>
		{/if}
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
		scroll-margin-top: var(--space-6);
	}
	.bild :global(.cg-voreinstellungen) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
	}
	.bild :global(.cg-voreinstellung) {
		min-height: 2rem;
		padding: 0;
		border: 0;
		border-bottom: var(--stroke) solid transparent;
		background: none;
		color: var(--ink-2);
		font-family: var(--font-sans);
		font-size: var(--text-s);
		cursor: pointer;
		touch-action: manipulation;
	}
	.bild :global(.cg-voreinstellung:hover),
	.bild :global(.cg-voreinstellung[data-state='checked']) {
		color: var(--ink);
	}
	.bild :global(.cg-voreinstellung[data-state='checked']) {
		border-bottom-color: var(--ink);
		font-weight: 600;
	}
	.bild :global(.cg-voreinstellung:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.bilanz {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-6);
	}
	.pad {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-1);
	}
	.pad :global(.cg-button) {
		padding: 0 var(--space-2);
	}
	.pad :global(.cg-button:last-child) {
		grid-column: 2;
	}
	p + p {
		margin-top: var(--space-2);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
	.zahlen {
		font-size: var(--text-xs);
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.bilanz {
		margin-bottom: var(--space-4);
	}
	@media (max-width: 960px) {
		.bild :global(.cg-voreinstellung) {
			min-width: 44px;
			min-height: 44px;
		}
		/* On mobile the image stays at the top: at most 45 % of the height, as in every demo. */
		.bild :global(.view) {
			height: min(420px, 45svh);
		}
		.bilanz {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-3);
		}
	}
</style>
