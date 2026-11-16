<script lang="ts">
	import { shares } from '../data/color';
	import { flows, flowToken, type FlowId } from '../data/focus';
	import type { Klasse } from '../logic/farbe/farblabor';

	/**
	 * Measured color share of the scene as one bar with the limit from 75/20/5.
	 * The finding stands as one sentence below it (aria-live), not as a column of numbers.
	 */
	let { anteil, stroeme }: { anteil: Record<Klasse, number>; stroeme: FlowId[] } = $props();

	const grenze = shares.find((s) => s.id === 'funktion')?.share ?? 20;
	const prozent = (x: number) => Math.round(x * 100);

	/** The colors of the flows in focus side by side, in palette order. */
	const farbe = $derived.by(() => {
		const im = flows.filter((f) => stroeme.includes(f.id));
		if (im.length < 2) return im.length ? `var(${flowToken[im[0].id]})` : 'transparent';
		const stopps = im.map((f, i) => {
			const a = ((i / im.length) * 100).toFixed(2);
			const b = (((i + 1) / im.length) * 100).toFixed(2);
			return `var(${flowToken[f.id]}) ${a}% ${b}%`;
		});
		return `linear-gradient(90deg, ${stopps.join(', ')})`;
	});

	const satz = $derived.by(() => {
		const n = prozent(anteil.funktion);
		if (!stroeme.length)
			return anteil.signal > 0
				? 'No flow color. Only the frame glows as signal.'
				: 'No color in the image: only paper and line.';
		return `${n}% of the surface carries color, three quarters stay quiet.`;
	});
</script>

<div class="anteil">
	<div
		class="balken"
		role="img"
		aria-label="Color share {prozent(anteil.funktion)} percent, limit {grenze} percent"
	>
		<span class="farbe" style:width="{anteil.funktion * 100}%" style:background={farbe}></span>
		<span class="signal" style:width="{anteil.signal * 100}%"></span>
		<span class="grenze" style:left="{grenze}%"></span>
	</div>
	<div class="skala" aria-hidden="true">
		<span style:left="{grenze}%">Limit {grenze}%</span>
	</div>
	<p aria-live="polite">{satz}</p>
</div>

<style>
	.anteil {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.balken {
		position: relative;
		display: flex;
		height: var(--space-3);
		background: var(--paper-2);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
	}
	.farbe,
	.signal {
		display: block;
		height: 100%;
		transition: width 240ms var(--ease);
	}
	.signal {
		background: var(--signal);
	}
	.grenze {
		position: absolute;
		top: calc(-1 * var(--space-1));
		bottom: calc(-1 * var(--space-1));
		width: var(--hair);
		background: var(--ink);
	}
	.skala {
		position: relative;
		height: var(--space-4);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	.skala span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	p {
		font-size: var(--text-m);
		line-height: 1.45;
	}
</style>
