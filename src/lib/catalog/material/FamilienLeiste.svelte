<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import Buehne from './Buehne.svelte';
	import { familien, type FamilieId } from '../data/materialSeite';
	import { leisteSzene, type Stueck } from '../logic/material/formen';
	import type { Strom } from '../logic/material/rezept';

	/**
	 * The nine families as studio spheres in the selected flow color, directly above the lab.
	 * One canvas draws all spheres; above it lies the selection as a Bits RadioGroup,
	 * one column per sphere. The strip scrolls on narrow screens; arrow keys browse every name.
	 */
	let {
		strom,
		fokus,
		value = $bindable('beton')
	}: { strom: Strom; fokus?: Stueck; value?: FamilieId } = $props();

	const stuecke = $derived(leisteSzene(strom, fokus));
</script>

<div class="scroll">
	<div class="leiste">
		<div class="kugeln">
			<Buehne
				{stuecke}
				studio
				label={fokus
					? 'Nine material families as spheres. The selected sphere shows the studio finish.'
					: 'Nine native material families as spheres.'}
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
</div>

<style>
	.scroll {
		min-width: 0;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
		padding: var(--space-1);
	}
	.leiste {
		position: relative;
		min-width: 630px;
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
	@media (max-width: 620px) {
		.leiste {
			min-width: 585px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.leiste :global(.cg-familie) {
			transition: none;
		}
	}
</style>
