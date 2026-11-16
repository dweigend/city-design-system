<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import Buehne from './Buehne.svelte';
	import { familien, type FamilieId } from '../data/materialSeite';
	import { leisteSzene } from '../logic/material/formen';
	import type { Strom } from '../logic/material/rezept';

	/**
	 * The nine families as spheres in the selected flow color, directly above the lab.
	 * One canvas draws all spheres; above it lies the selection as a Bits RadioGroup,
	 * one column per sphere. Arrow keys move through the row.
	 */
	let { strom, value = $bindable('beton') }: { strom: Strom; value?: FamilieId } = $props();

	const stuecke = $derived(leisteSzene(strom));
</script>

<div class="leiste">
	<div class="kugeln">
		<Buehne
			{stuecke}
			label="Nine material families as spheres"
			verhaeltnis="9 / 1.15"
			hoeheDeg={20}
			azimutDeg={0}
			rand={0.026}
			rahmen={false}
			bewegung={false}
		/>
	</div>
	<RadioGroup.Root
		value={value as string}
		onValueChange={(v) => (value = v as FamilieId)}
		aria-label="Material family"
		orientation="horizontal"
		class="cg-familien"
	>
		{#each familien as f (f.id)}
			<RadioGroup.Item value={f.id} class="cg-familie" aria-label={f.name} title={f.name}>
				<span class="name">{f.name}</span>
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
</div>

<style>
	.leiste {
		position: relative;
		padding-bottom: calc(var(--text-xs) * 1.6 + var(--space-2));
		border-bottom: var(--hair) solid var(--line);
	}
	.leiste :global(.cg-familien) {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
	}
	.leiste :global(.cg-familie) {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
		padding: 0 0 var(--space-1);
		border: 0;
		border-bottom: var(--stroke) solid transparent;
		margin-bottom: calc(-1 * var(--hair));
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		text-align: center;
		cursor: pointer;
		touch-action: manipulation;
		transition:
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	.leiste :global(.cg-familie:hover) {
		color: var(--ink);
	}
	.leiste :global(.cg-familie[data-state='checked']) {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}
	.leiste :global(.cg-familie[data-state='checked'] .name) {
		font-weight: 600;
	}
	.leiste :global(.cg-familie:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -2px;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Narrow: only spheres; the name stands below the lab. */
	@media (max-width: 720px) {
		.leiste {
			padding-bottom: var(--space-2);
		}
		.name {
			display: none;
		}
	}
</style>
