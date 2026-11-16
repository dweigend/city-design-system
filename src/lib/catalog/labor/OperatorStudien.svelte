<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import ChoiceControl from './ChoiceControl.svelte';
	import PrimitiveView from '../scene/PrimitiveView.svelte';
	import Scale from '../ui/Scale.svelte';
	import { repetition } from '../logic/parametrik/repetition';
	import { path } from '../logic/parametrik/path';
	import { studienListe } from '../data/labor';

	/**
	 * Two standalone operator studies on one stage (one 3D context instead of two):
	 * repetition with variation and profile along a path. They belong to no chapter.
	 */
	const START = {
		studie: 'wiederholung',
		anzahl: 10,
		streuung: 0.4,
		punkte: 5,
		radius: 0.8,
		saat: 42
	};
	let studie = $state<string>(START.studie),
		anzahl = $state(START.anzahl),
		streuung = $state(START.streuung),
		punkte = $state(START.punkte),
		radius = $state(START.radius),
		saat = $state(START.saat),
		offen = $state('form');
	let view = $state<ReturnType<typeof PrimitiveView>>();

	const info = $derived(studienListe.find((s) => s.id === studie) ?? studienListe[0]);
	const primitives = $derived(
		studie === 'pfad'
			? path({ points: punkte, radius, seed: saat })
			: repetition({ amount: anzahl, spread: streuung, seed: saat })
	);
	function zuruecksetzen() {
		studie = START.studie;
		anzahl = START.anzahl;
		streuung = START.streuung;
		punkte = START.punkte;
		radius = START.radius;
		saat = START.saat;
		offen = 'form';
		view?.reset();
	}
	const meter = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} m`;
</script>

<DemoLayout label="Operator studies" bind:offen onreset={zuruecksetzen}>
	{#snippet bild()}
		<PrimitiveView bind:this={view} {primitives} tools={false} label={info.name} />
	{/snippet}
	{#snippet steuerung()}
		<ChoiceControl
			id="studie-wahl"
			label="Study"
			bind:value={studie}
			items={studienListe.map((s) => ({ value: s.id, label: s.name }))}
		/>
		<Steuergruppe wert="form" titel="Form">
			{#if studie === 'pfad'}
				<Scale live label="Curve points" bind:value={punkte} min={3} max={9} step={1} />
				<Scale
					live
					label="Profile radius"
					bind:value={radius}
					min={0.25}
					max={2}
					step={0.05}
					format={meter}
				/>
			{:else}
				<Scale live label="Count" bind:value={anzahl} min={3} max={18} step={1} />
				<Scale
					live
					label="Scatter"
					bind:value={streuung}
					min={0}
					max={1}
					step={0.01}
					format={(v) => `${Math.round(v * 100)} %`}
				/>
			{/if}
		</Steuergruppe>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="studie-saat" bind:value={saat} />
		</Steuergruppe>
	{/snippet}
	{#snippet unterschrift()}
		<p><b>{info.name}.</b> {info.text}</p>
	{/snippet}
</DemoLayout>

<style>
	b {
		font-weight: 600;
		color: var(--ink);
	}
</style>
