<script lang="ts">
	import { ICON_RAND, ICON_RASTER, ICON_STRICH, type IconZeichnung } from '../data/icons';

	/**
	 * Construction sheet: one drawing large on the 24 grid.
	 * The hairline is the axis, the band the stroke at 24 px, the frame the drawing area.
	 */
	let {
		items,
		label
	}: {
		items: { id: string; titel: string; text: string; icon: IconZeichnung; ton?: string }[];
		label: string;
	} = $props();

	const linien = Array.from({ length: ICON_RASTER + 1 }, (_, i) => i);
	const innen = ICON_RASTER - 2 * ICON_RAND;
</script>

<ul aria-label={label}>
	{#each items as it (it.id)}
		<li>
			<svg
				viewBox="0 0 {ICON_RASTER} {ICON_RASTER}"
				style:--icon-ton={it.ton ? `var(${it.ton})` : undefined}
				aria-hidden="true"
			>
				<g class="raster">
					{#each linien as i (i)}<path d="M{i} 0V{ICON_RASTER}M0 {i}H{ICON_RASTER}" />{/each}
				</g>
				<rect class="rand" x={ICON_RAND} y={ICON_RAND} width={innen} height={innen} />
				{#each [it.icon.flaeche, it.icon.masse, it.icon.linie] as d, i (i)}
					{#if d}
						<path class="band" {d} stroke-width={ICON_STRICH} />
						<path class="achse" class:flaeche={i === 0} class:masse={i === 1} {d} />
					{/if}
				{/each}
			</svg>
			<b>{it.titel}</b>
			<span>{it.text}</span>
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(
			auto-fit,
			minmax(min(var(--u50), 100%), calc(var(--u100) - var(--u10)))
		);
		gap: var(--space-8) var(--space-6);
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-s);
	}
	svg {
		width: 100%;
		height: auto;
		margin-bottom: var(--space-3);
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	path,
	rect {
		vector-effect: non-scaling-stroke;
		stroke-width: var(--hair);
	}
	.raster {
		stroke: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.rand {
		stroke: var(--ink-3);
	}
	.band {
		vector-effect: none;
		stroke: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.achse {
		stroke: var(--ink);
	}
	.flaeche {
		fill: var(--icon-ton, none);
		fill-rule: evenodd;
	}
	.masse {
		fill: color-mix(in srgb, var(--ink) 30%, transparent);
	}
	b {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	span {
		color: var(--ink-2);
	}
	/* Narrow: three sheets side by side instead of stacked, the grid stays legible. */
	@media (max-width: 600px) {
		ul {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: var(--space-4) var(--space-2);
		}
		li {
			font-size: var(--text-xs);
		}
	}
</style>
