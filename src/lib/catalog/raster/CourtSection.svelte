<script lang="ts">
	import type { CourtStudy } from './court-study.server';
	let { section, showCaption = true }: { section: CourtStudy['section']; showCaption?: boolean } =
		$props();
	const x = (metres: number) => 20 + (metres + 42) * 7.5;
	const y = (metres: number) => 155 - metres * 4.4;
	const terrain = $derived(section.terrain.map(([u, v]) => x(u) + ',' + y(v)).join(' '));
	const walls = $derived([...section.buildings].sort((a, b) => a.left - b.left));
	const square = $derived(section.square.map(x));
</script>

<figure>
	{#if showCaption}
		<figcaption><strong>Section A–A′</strong><span>Planned envelope</span></figcaption>
	{/if}
	<svg
		viewBox="0 0 370 161"
		role="img"
		aria-label="Section through the open square and house group. An outlined coarse envelope surrounds the occupied storeys and their subgrid."
	>
		<path
			class="envelope"
			d={'M' +
				x(walls[0].left) +
				' ' +
				y(walls[0].pad) +
				' V' +
				y(section.envelope) +
				' H' +
				x(walls[walls.length - 1].right) +
				' V' +
				y(walls[walls.length - 1].pad)}
		/>
		{#each walls as wall (wall.left)}
			<rect
				class="subgrid"
				x={x(wall.left)}
				y={y(section.envelope)}
				width={x(wall.right) - x(wall.left)}
				height={y(wall.pad) - y(section.envelope)}
			/>
			<rect
				class:added={wall.added}
				class="body"
				x={x(wall.left)}
				y={y(wall.pad + wall.stories * section.story)}
				width={x(wall.right) - x(wall.left)}
				height={wall.stories * section.story * 4.4}
			/>
			{#each Array(wall.stories - 1).keys() as i (i)}
				<line
					class="floor"
					x1={x(wall.left)}
					x2={x(wall.right)}
					y1={y(wall.pad + (i + 1) * section.story)}
					y2={y(wall.pad + (i + 1) * section.story)}
				/>
			{/each}
		{/each}
		<polygon class="earth" points={'20,159 ' + terrain + ' 350,159'} />
		<polyline class="ground" points={terrain} />
		<path class="bracket" d={'M' + square[0] + ' 113v4H' + square[1] + 'v-4'} />
		<text x={(square[0] + square[1]) / 2} y="108" text-anchor="middle">Kept-free square</text>
		<text x="20" y="133">Terrain</text>
		<text x={x(walls[0].left)} y={y(section.envelope) - 8}>Coarse envelope</text>
	</svg>
</figure>

<style>
	figure {
		margin: 0;
	}
	figcaption {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	strong {
		font-size: var(--text-m);
	}
	span {
		font: var(--text-xs) var(--font-mono);
		color: var(--ink-2);
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 175px;
	}
	.subgrid,
	.envelope,
	.bracket,
	.ground {
		fill: none;
		stroke: var(--ink-2);
	}
	.envelope {
		stroke-width: 1.6;
	}
	.subgrid {
		stroke-width: 0.65;
		stroke-dasharray: 2 2;
	}
	.body {
		fill: var(--ink-2);
		stroke: var(--paper);
		stroke-width: 0.7;
	}
	.added {
		fill: var(--signal);
	}
	.floor {
		stroke: var(--paper);
		stroke-width: 0.8;
	}
	.earth {
		fill: var(--paper-3);
	}
	.ground {
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	text {
		font: 10px var(--font-sans);
		fill: var(--ink);
	}
</style>
