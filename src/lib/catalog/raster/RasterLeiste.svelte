<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import type { RasterVorschau } from '../logic/bibel/raster';

	/**
	 * The nine grids as top views directly above the simulation, from strict to organic.
	 * A click switches the grid of the simulation below; arrow keys move through the row.
	 */
	let { items, value = $bindable('') }: { items: readonly RasterVorschau[]; value?: string } =
		$props();
</script>

<div class="leiste">
	<RadioGroup.Root bind:value aria-label="Grid" orientation="horizontal" class="reihe">
		{#each items as r (r.id)}
			<RadioGroup.Item value={r.id} class="raster" aria-label={r.name} title={r.name}>
				<svg viewBox={r.viewBox} aria-hidden="true">
					<path class="zellen" d={r.zellen} />
					<path class="bloecke" d={r.bloecke} />
				</svg>
				<span class="name">{r.name}</span>
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
	<div class="achse" aria-hidden="true"><span>strict</span><span>organic</span></div>
</div>

<style>
	.leiste {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.leiste :global(.reihe) {
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.leiste :global(.raster) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	svg {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		transition: border-color var(--fast) var(--ease);
	}
	path {
		fill: none;
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
	}
	.zellen {
		stroke: var(--ink-3);
		stroke-width: 0.5;
		opacity: 0.7;
	}
	.bloecke {
		stroke: var(--ink-2);
		stroke-width: 1;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.leiste :global(.raster:hover) {
		color: var(--ink);
	}
	.leiste :global(.raster[data-state='checked']) {
		color: var(--ink);
	}
	.leiste :global(.raster[data-state='checked'] .name) {
		font-weight: 600;
	}
	.leiste :global(.raster[data-state='checked'] svg) {
		border-color: var(--ink);
		outline: var(--hair) solid var(--ink);
	}
	.leiste :global(.raster[data-state='checked'] .bloecke) {
		stroke: var(--ink);
	}
	.leiste :global(.raster:focus-visible) {
		outline: none;
	}
	.leiste :global(.raster:focus-visible svg) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.achse {
		display: flex;
		justify-content: space-between;
		padding-top: var(--space-1);
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	/* Narrow: only top views, the name stands below the simulation. */
	@media (max-width: 720px) {
		.leiste :global(.reihe) {
			gap: var(--space-1);
		}
		.name {
			display: none;
		}
	}
</style>
