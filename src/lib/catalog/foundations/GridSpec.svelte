<script lang="ts">
	import Paper from './Paper.svelte';
	import { PANEL, gridLevels, lineWeights, planSquares, planNodes, iso } from '../data/grid';
</script>

<!-- Two drawings on graph paper, legend below on a white ground. Pixel convention see Paper.svelte. -->
<div class="scroll">
	<div class="sheet">
		<Paper>
			<div class="board">
				<svg
					width={PANEL}
					height={PANEL}
					viewBox="0 0 {PANEL} {PANEL}"
					role="img"
					aria-label="Floor plan: field, parcel and block at a shared corner."
				>
					<g transform="translate(0.5 0.5)">
						{#each planSquares as s (s.id)}
							<rect x={s.x} y={s.y} width={s.size} height={s.size} />
							<line x1={s.x + s.size} y1={s.y - 4} x2={s.x + s.size} y2={s.y} />
						{/each}
					</g>
					{#each planNodes as [x, y] (`${x},${y}`)}<rect
							class="node"
							x={x - 1}
							y={y - 1}
							width="4"
							height="4"
						/>{/each}
					{#each planSquares as s (s.id)}<text x={s.label[0]} y={s.label[1]} text-anchor="middle"
							>{s.units}</text
						>{/each}
				</svg>

				<svg
					width={PANEL}
					height={PANEL}
					viewBox="0 0 {PANEL} {PANEL}"
					role="img"
					aria-label="Isometric 2:1: a parcel of 5 × 5 fields on the same nodes."
				>
					<polygon class="veil" points={iso.outline} />
					<g transform="translate(0.5 0.5)">
						{#each iso.lines as [a, b], i (i)}<line
								class="soft"
								x1={a[0]}
								y1={a[1]}
								x2={b[0]}
								y2={b[1]}
							/>{/each}
						<polygon points={iso.outline} />
					</g>
					{#each iso.nodes as [x, y] (`${x},${y}`)}<rect
							class="node"
							x={x - 1}
							y={y - 1}
							width="4"
							height="4"
						/>{/each}
				</svg>
			</div>
		</Paper>
	</div>
</div>

<div class="key">
	<ul>
		{#each gridLevels as l (l.id)}<li>
				<b>{l.units}</b><span>{l.name}</span><span class="px">{l.px} px</span>
			</li>{/each}
	</ul>
	<ul>
		{#each lineWeights as w (w.id)}<li>
				<span class="sample" style:height="var({w.token})" aria-hidden="true"></span><span
					>{w.name}</span
				><span class="px">{w.px} px</span>
			</li>{/each}
	</ul>
</div>

<style>
	/* Fixed sheet sizes (n · 40 + 1 px), so every line lies on its paper line. */
	.scroll {
		overflow-x: auto;
	}
	.sheet {
		width: 481px;
	}
	.board {
		display: grid;
		grid-template-columns: 480px;
		grid-template-rows: 480px 480px;
		height: 961px;
	}
	@media (min-width: 1057px) {
		.sheet {
			width: 961px;
		}
		.board {
			grid-template-columns: 480px 480px;
			grid-template-rows: 480px;
			height: 481px;
		}
	}

	/* One line weight for the whole drawing */
	svg {
		max-width: none;
		overflow: visible;
	}
	svg rect,
	svg polygon,
	svg line {
		fill: none;
		stroke: var(--ink);
		stroke-width: var(--hair);
	}
	svg .soft {
		stroke: color-mix(in srgb, var(--ink) 40%, var(--paper));
	}
	svg .node {
		fill: var(--ink);
		stroke: none;
	}
	/* Semi-transparent layer: the paper below the isometric view steps back */
	svg .veil {
		fill: color-mix(in srgb, var(--paper) 80%, transparent);
		stroke: none;
	}
	/* Numbers knocked out in white, so no grid line runs through */
	svg text {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: var(--space-1);
		stroke-linejoin: round;
	}

	/* Legend: steps and lines, nothing else */
	.key {
		display: flex;
		gap: var(--space-16);
		margin-top: var(--space-8);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: var(--u10) var(--space-20) var(--u10);
		align-items: center;
		height: var(--ctl-s);
		font-size: var(--text-s);
	}
	b {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.px {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
		text-align: right;
	}
	.sample {
		display: block;
		width: var(--space-6);
		background: var(--ink);
	}
</style>
