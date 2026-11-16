<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '../../ui/Button.svelte';
	import Buehne from './Buehne.svelte';
	import FormLoop from '../FormLoop.svelte';
	import type { Vec3 } from '../../logic/parametrik/types';
	import {
		mensch,
		WEG,
		wegDauern,
		wegGruppe,
		wegLauf,
		wegSchritte,
		wegTurm
	} from '../../logic/formen';
	import { wegLoop } from '../../data/turm';

	/**
	 * Loop “One path through all levels”: a person walks from the square up the ramp; each
	 * level receives its color on arrival, its name stands in place. At the top the path ends in the garden.
	 * The person moves via group offsets; rebuilding happens only on arrival.
	 */
	let { onausprobieren }: { onausprobieren?: () => void } = $props();

	let t = $state(0),
		spielt = $state(true);
	const lauf = $derived(wegLauf(t));
	const erreicht = $derived(lauf.erreicht);
	const primitives = $derived.by(() => {
		const n = erreicht;
		return untrack(() => [...wegTurm(n), ...mensch]);
	});
	const offsets = $derived(new Map<string, Vec3>([['mensch', lauf.mensch]]));
	const ansicht = { center: [0, 0, 10.5] as Vec3, span: 15 };
	const schritte = wegSchritte.map((s) => ({
		id: s.id,
		titel: wegLoop.ebene[s.id],
		text: wegLoop.text[s.id]
	}));
	/** Label in place: to the right of the ramp, centered in the level. */
	const anker = (z: number, h: number): Vec3 => [WEG.aussen * 0.75, -WEG.aussen * 0.75, z + h / 2];
</script>

<FormLoop
	id="formen-weg"
	label={wegLoop.titel}
	schrittLabel={wegLoop.schritte}
	{schritte}
	dauern={wegDauern}
	bind:t
	bind:spielt
	standbild={3}
>
	<Buehne
		{primitives}
		view={ansicht}
		groupOf={wegGruppe}
		{offsets}
		drehbar={false}
		verhaeltnis="16 / 10"
		label="{wegLoop.titel}: a person walks from the square over a ramp through five levels into the garden."
	>
		{#snippet marken(ort)}
			{#if lauf.ebene}
				{@const p = ort(anker(lauf.ebene.z, Math.max(2, lauf.ebene.hoehe)))}
				{#if p.sichtbar}
					<span class="marke" style:left="{p.x}px" style:top="{p.y}px"
						>{wegLoop.ebene[lauf.ebene.id]}</span
					>
				{/if}
			{/if}
		{/snippet}
	</Buehne>
	{#snippet extra()}
		{#if onausprobieren}
			<div>
				<Button variant="secondary" label={wegLoop.ausprobieren} onclick={onausprobieren} />
			</div>
		{/if}
	{/snippet}
</FormLoop>

<style>
	.marke {
		position: absolute;
		transform: translate(var(--space-2), -50%);
		padding: 0 var(--space-1);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
		font-weight: 600;
		white-space: nowrap;
	}
</style>
