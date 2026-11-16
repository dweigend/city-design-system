<script lang="ts">
	import { GRENZWINKEL } from '../logic/bibel/spielraum';
	import { gradText } from './spielraumBild';

	/**
	 * Protractor of the selected corner: smallest and largest angle of its quads as wedges on
	 * a shared baseline, as on a set square. The light arc is the permitted
	 * range (5° to under 180°); when a wedge reaches its limit, it changes color and the corner stops.
	 */
	let { kleinster, groesster, seiten }: { kleinster: number; groesster: number; seiten: number } =
		$props();

	// Room for labels on the left and right: they stay in the image, even at 0° and 180°.
	const CX = 140,
		CY = 104,
		R = 84;
	const klemm = (g: number) => Math.max(0, Math.min(180, g));
	const pol = (g: number, r = R) => {
		const t = (klemm(g) * Math.PI) / 180;
		return { x: CX + r * Math.cos(t), y: CY - r * Math.sin(t) };
	};
	const bogen = (von: number, bis: number, r = R) => {
		const a = pol(von, r),
			b = pol(bis, r);
		return `M ${a.x} ${a.y} A ${r} ${r} 0 0 0 ${b.x} ${b.y}`;
	};
	const keil = (g: number, r: number) =>
		`M ${CX} ${CY} L ${CX + r} ${CY} ${bogen(0, g, r).slice(1)} Z`;
	const grad = gradText;
	const zahl = (v: number) => v.toFixed(1).replace('.', ',');

	const spitzGrenze = $derived(kleinster < GRENZWINKEL + 1);
	const weitGrenze = $derived(groesster > 179);
	// Labels never on top of each other: fan them apart when the span is tight.
	const ABSTAND = 26;
	const lagen = $derived.by(() => {
		const m = (kleinster + groesster) / 2,
			d = Math.max(groesster - kleinster, ABSTAND) / 2;
		const lo = Math.max(-4, Math.min(m - d, 184 - 2 * d)),
			hi = lo + 2 * Math.max(d, (groesster - kleinster) / 2);
		return { lo, hi };
	});
	const beschriftung = (g: number) => {
		const t = (g * Math.PI) / 180,
			c = Math.cos(t);
		return {
			x: CX + (R + 12) * c,
			y: CY - (R + 12) * Math.sin(t) + 4,
			anker: c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle'
		};
	};
	const lo = $derived(beschriftung(lagen.lo));
	const hi = $derived(beschriftung(lagen.hi));
</script>

<figure class="messer">
	<figcaption>Angle at the selected corner</figcaption>
	<svg
		viewBox="0 0 280 120"
		role="img"
		aria-label="Smallest angle {grad(kleinster)}, largest {grad(
			groesster
		)}. Permitted from {GRENZWINKEL}° to under 180°."
	>
		<path class="spur" d={bogen(GRENZWINKEL, 180)} />
		<path class="sperre" d={bogen(0, GRENZWINKEL)} />
		<line class="basis" x1={CX - R - 6} y1={CY} x2={CX + R + 6} y2={CY} />
		{#each [0, 45, 90, 135, 180] as g (g)}
			{@const a = pol(g, R - 5)}
			{@const b = pol(g, R + 5)}
			<line class="tick" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
		{/each}
		<path class="keil weit" class:grenze={weitGrenze} d={keil(groesster, R - 14)} />
		<path class="keil spitz" class:grenze={spitzGrenze} d={keil(kleinster, R - 30)} />
		<path class="spanne" d={bogen(kleinster, groesster)} />
		{#each [[kleinster, spitzGrenze], [groesster, weitGrenze]] as const as [g, an], i (i)}
			{@const p = pol(g)}
			<line class="zeiger" class:grenze={an} x1={CX} y1={CY} x2={p.x} y2={p.y} />
			<circle class="ende" class:grenze={an} cx={p.x} cy={p.y} r="3.5" />
		{/each}
		<text class="wert" class:grenze={spitzGrenze} x={lo.x} y={lo.y} text-anchor={lo.anker}
			>{grad(kleinster)}</text
		>
		<text class="wert" class:grenze={weitGrenze} x={hi.x} y={hi.y} text-anchor={hi.anker}
			>{grad(groesster)}</text
		>
		<text class="skala" x={CX + R + 2} y={CY + 13} text-anchor="middle">0°</text>
		<text class="skala" x={CX - R - 2} y={CY + 13} text-anchor="middle">180°</text>
	</svg>
	<p>Any angle from {GRENZWINKEL}° to just under 180° is permitted.</p>
	<p>Longest side {zahl(seiten)} times as long as the shortest.</p>
</figure>

<style>
	.messer {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	svg {
		display: block;
		width: 100%;
		max-width: 320px;
		overflow: visible;
	}
	path,
	line,
	circle {
		vector-effect: non-scaling-stroke;
	}
	.spur {
		fill: none;
		stroke: var(--paper-3);
		stroke-width: 7;
	}
	.sperre {
		fill: none;
		stroke: var(--signal);
		stroke-width: 7;
		opacity: 0.35;
	}
	.basis,
	.tick {
		stroke: var(--ink-3);
		stroke-width: 1;
	}
	.keil {
		stroke: none;
		transition: fill 160ms ease;
	}
	.keil.weit {
		fill: color-mix(in oklch, var(--blueprint) 12%, transparent);
	}
	.keil.spitz {
		fill: color-mix(in oklch, var(--blueprint) 26%, transparent);
	}
	.keil.grenze {
		fill: color-mix(in oklch, var(--signal) 16%, transparent);
	}
	.spanne {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.zeiger {
		stroke: var(--ink);
		stroke-width: 1;
	}
	.ende {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.zeiger.grenze {
		stroke: var(--signal);
	}
	.ende.grenze {
		fill: var(--signal);
		stroke: var(--signal);
	}
	text {
		font-variant-numeric: tabular-nums;
	}
	.skala {
		font-size: 9px;
		fill: var(--ink-3);
	}
	.wert {
		font-size: 12px;
		font-weight: 600;
		fill: var(--ink);
	}
	.wert.grenze {
		fill: var(--signal);
	}
	p {
		line-height: 1.5;
	}
	@media (prefers-reduced-motion: reduce) {
		.keil {
			transition: none;
		}
	}
</style>
