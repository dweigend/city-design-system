<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Button from '../ui/Button.svelte';
	import Buehne from './Buehne.svelte';
	import FamilienLeiste from './FamilienLeiste.svelte';
	import { Label } from 'bits-ui';
	import { achsenWahl, bestandHinweis, familie, formWahl } from '../data/materialSeite';
	import { konstruktion, laborFormen, montageText } from '../data/materialKapitel';
	import { flows } from '../data/focus';
	import { ausfuehrungenVon } from '../logic/material/ausfuehrung';
	import { materialVariation, maximaleMusterSaat, rauschWahl } from '../logic/material/variation';
	import type { MaterialWahl, MaterialWerkstatt } from '../logic/material/werkstatt';

	let {
		werkstatt,
		waehle,
		onreset
	}: { werkstatt: MaterialWerkstatt; waehle: MaterialWahl; onreset: () => void } = $props();
	let offen = $state('haut');
	let buehne = $state<Buehne>();
	const z = $derived(werkstatt.auswahl);
	const finish = $derived(z.finish);
	const fam = $derived(finish.familie);
	const f = $derived(familie(fam));
	const form = $derived(z.form);
	const finishAktiv = $derived(werkstatt.fokus !== undefined);
	const finishWahl = $derived(ausfuehrungenVon(fam).map((a) => ({ value: a.id, label: a.name })));
	const formen = [...laborFormen, ...formWahl];
	const formName = $derived(formen.find((x) => x.value === form)?.label);
	const stromName = $derived(
		werkstatt.stromAktiv && flows.find((x) => x.id === z.wahl.strom)?.name
	);
	const stroeme = [
		{ value: 'neutral', label: 'None' },
		...flows.map((x) => ({ value: x.id, label: x.name }))
	];

	function setzeSaat(input: HTMLInputElement) {
		const { seed } = materialVariation(z.variation.noise, input.valueAsNumber);
		input.value = String(seed);
		waehle('seed', seed);
	}

	function zuruecksetzen() {
		onreset();
		offen = 'haut';
		buehne?.zuruecksetzen();
	}
</script>

<DemoLayout label="Material lab" onreset={zuruecksetzen} bind:offen>
	{#snippet bild()}
		<div class="bild">
			<FamilienLeiste
				fokus={werkstatt.fokus}
				strom={z.wahl.strom}
				bind:value={() => fam, (v) => waehle('familie', v)}
			/>
			<div class="formen">
				<ChoiceControl
					id="material-form"
					label="Form"
					bind:value={() => form, (v) => waehle('form', v)}
					items={formen}
				/>
			</div>
			<Buehne
				bind:this={buehne}
				stuecke={werkstatt.stuecke}
				studio
				drehen
				label="{finishAktiv
					? `${f.name}, ${finish.name}`
					: 'Native assembly'}, {formName}. {form === 'probe' ? konstruktion[fam] : ''} {form ===
				'montage'
					? 'Fixed assembly colors.'
					: stromName
						? `Flow ${stromName}.`
						: 'Native color.'} Drag or arrow keys rotate, scroll wheel or plus and minus zoom."
			/>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="haut" titel="Surface">
			{#if finishAktiv}
				<ChoiceControl
					id="material-finish"
					label="Finish"
					bind:value={() => finish.id, (v) => waehle('finish', v)}
					items={finishWahl}
				/>
			{/if}
			{#if werkstatt.stromAktiv}
				<ChoiceControl
					id="material-strom"
					label="Flow color"
					bind:value={() => z.wahl.strom, (v) => waehle('strom', v)}
					items={stroeme}
				/>
			{:else if form !== 'montage'}
				<p class="hinweis">{f.ohneStrom ?? `${finish.name} uses its own color.`}</p>
			{/if}
			{#if (form === 'probe' && fam === 'wasser') || form === 'montage'}
				<div class="wellen">
					<Button variant="secondary" label="Replay waves" onclick={() => buehne?.wasserStart()} />
				</div>
			{/if}
		</Steuergruppe>
		{#if form !== 'montage'}
			<Steuergruppe wert="fein" titel="Fine tuning">
				<p class="hinweis">Steps relative to the finish.</p>
				<ChoiceControl
					id="material-rauheit"
					label="Roughness"
					bind:value={() => z.wahl.rauheit, (v) => waehle('rauheit', v)}
					items={[...achsenWahl.rauheit]}
				/>
				<ChoiceControl
					id="material-glanz"
					label="Gloss"
					bind:value={() => z.wahl.glanz, (v) => waehle('glanz', v)}
					items={[...achsenWahl.glanz]}
				/>
				{#if werkstatt.deckkraftAktiv}<ChoiceControl
						id="material-deckkraft"
						label="Opacity"
						bind:value={() => z.wahl.deckkraft, (v) => waehle('deckkraft', v)}
						items={[...achsenWahl.deckkraft]}
					/>{:else}<p class="hinweis">
						Explore opacity in <a href="#material-rezept">the diagram recipe</a>.
					</p>{/if}
				{#if werkstatt.kanteAktiv}<ChoiceControl
						id="material-kante"
						label="Edge rendering"
						bind:value={() => z.wahl.kante, (v) => waehle('kante', v)}
						items={[...achsenWahl.kante]}
					/>{/if}
				{#if werkstatt.variationAktiv}
					<ChoiceControl
						id="material-noise"
						label="Noise"
						items={[...rauschWahl]}
						bind:value={() => z.variation.noise, (v) => waehle('noise', v)}
					/>
					<div class="saat">
						<Label.Root for="material-saat">Seed</Label.Root>
						<input
							id="material-saat"
							name="material-saat"
							type="number"
							min="0"
							max={maximaleMusterSaat}
							step="1"
							inputmode="numeric"
							autocomplete="off"
							aria-describedby="material-saat-hilfe"
							value={z.variation.seed}
							onchange={(e) => setzeSaat(e.currentTarget)}
						/>
						<p class="hinweis" id="material-saat-hilfe">
							Move the grain pattern. Seed 0 restores its original position.
						</p>
					</div>
				{/if}
			</Steuergruppe>
		{/if}
	{/snippet}

	{#snippet unterschrift()}
		{#if finishAktiv}<p><b>{f.name} · {finish.name}.</b> {finish.beschreibung}</p>{/if}
		{#if form === 'probe'}<p>{konstruktion[fam]}</p>{/if}
		{#if form === 'montage'}
			{#if !finishAktiv}<p>{f.name} has no editable pieces in this assembly.</p>{/if}
			<p>{montageText}</p>{/if}
		{#if form === 'bestand' && fam !== 'bestand'}
			<p>{bestandHinweis}</p>
		{/if}
	{/snippet}
</DemoLayout>

<style>
	@media (prefers-reduced-motion: reduce) {
		.wellen {
			display: none;
		}
	}

	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	p + p {
		margin-top: var(--space-2);
	}
	/* Form choices use the same type as the family strip and wrap inside the stage width. */
	.formen {
		--steuer-schrift: var(--font-sans);
		--steuer-groesse: var(--text-s);
		--steuer-luft: var(--space-1);
		padding: 0 var(--space-1);
	}
	.formen :global(.option) {
		flex: none;
		min-height: 36px;
	}
	.formen :global(label) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.saat {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-s);
	}
	.saat p {
		grid-column: 1 / -1;
	}
	.saat input {
		min-width: 0;
		height: var(--ctl-m);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		padding: 0 var(--space-2);
		font: inherit;
	}
	.saat input:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -1px;
	}
	.hinweis {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
</style>
