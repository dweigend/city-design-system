<script lang="ts">
	import type { Knoten } from '../logic/bibel/wege';
	import type { HochwegKante } from '../logic/stadt/hochwege';

	let {
		knoten,
		kanten,
		hover = $bindable<string | undefined>(undefined)
	}: {
		knoten: Knoten[];
		kanten: HochwegKante[];
		hover?: string;
	} = $props();
	const box = $derived.by(() => {
		const xs = knoten.map((n) => n.x),
			ys = knoten.map((n) => n.y);
		return `${Math.min(...xs) - 3} ${-Math.max(...ys) - 3} ${Math.max(...xs) - Math.min(...xs) + 6} ${Math.max(...ys) - Math.min(...ys) + 6}`;
	});
</script>

<svg
	viewBox={box}
	role="img"
	aria-label="Elevated walkway network: circles show gallery walkways, squares rooftop walkways. Ink shows the spanning tree, dashed signal color the loops."
>
	{#each kanten.filter((e) => e.anteil > 0) as e (e.target)}
		{@const a = knoten[e.a]}
		{@const b = knoten[e.b]}
		<line
			x1={a.x}
			y1={-a.y}
			x2={a.x + (b.x - a.x) * e.anteil}
			y2={-a.y - (b.y - a.y) * e.anteil}
			class:schleife={e.schleife}
			class:aktiv={hover === e.target || hover === `knoten:${a.id}` || hover === `knoten:${b.id}`}
		/>
	{/each}
	{#each knoten as n (n.id)}
		<g
			role="img"
			aria-label={`${n.ebene === 2 ? 'Gallery walkway' : 'Rooftop walkway'} ${n.id}`}
			class:aktiv={hover === `knoten:${n.id}`}
			onpointerenter={() => (hover = `knoten:${n.id}`)}
			onpointerleave={() => (hover = undefined)}
		>
			<title>{n.ebene === 2 ? 'Gallery walkway' : 'Rooftop walkway'} · {n.id}</title>
			{#if n.ebene === 2}
				<circle cx={n.x} cy={-n.y} r={1} />
			{:else}
				<rect x={n.x - 1} y={-n.y - 1} width={2} height={2} />
			{/if}
		</g>
	{/each}
</svg>

<style>
	svg {
		display: block;
		width: min(100%, 220px);
		max-height: 150px;
	}
	line,
	circle,
	rect {
		vector-effect: non-scaling-stroke;
	}
	line {
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.schleife {
		stroke: var(--signal);
		stroke-dasharray: 4 2;
	}
	line.aktiv {
		stroke-width: 3;
	}
	circle,
	rect {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	g.aktiv circle,
	g.aktiv rect {
		fill: var(--ink);
	}
</style>
