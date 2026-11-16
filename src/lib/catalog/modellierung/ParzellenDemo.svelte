<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';
	import Bildleiste from './Bildleiste.svelte';
	import { chronik, points, type AccessClass, type ParcelState } from '../logic/parzelle';
	import { epochen, nutzungen, parzellenBloecke, parzellenLegende as L } from '../data/wachstum';

	/**
	 * Parcels without streets: founding at access edges, a shared courtyard, then three eras with their own
	 * drivers (split, merge, convert). Existing stock stays gray, whatever was created or converted
	 * in the running era carries a strong outline. Block as an image strip, eras as a
	 * step strip. Same seed, same chronicle; the image is a function of the clock time.
	 */
	const DAUER = 4.5;
	const STILL = 0.5;
	const START = { block: 'gassen', saat: 7 };
	let block = $state(START.block),
		saat = $state(START.saat);

	const uhr = new LoopUhr(true, STILL * DAUER);
	const stand = $derived(phaseBei(uhr.sekunden, epochen.length, DAUER));

	const wahl = $derived(parzellenBloecke.find((b) => b.id === block) ?? parzellenBloecke[0]);
	const ergebnis = $derived(chronik(wahl.spec, saat, wahl.schutz, epochen));
	const zeit = $derived(ergebnis.ok ? ergebnis.value[stand.index] : undefined);

	type Klasse = AccessClass;
	const kante: Record<Klasse, { klasse: string; name: string }> = {
		footway: { klasse: 'gasse', name: L.gasse },
		square: { klasse: 'platz', name: L.platz },
		skywalk: { klasse: 'hochweg', name: L.hochweg },
		stop: { klasse: 'halt', name: L.halt },
		green: { klasse: 'gruen', name: L.gruen },
		water: { klasse: 'ufer', name: L.ufer },
		transit: { klasse: 'wand', name: L.wand },
		party: { klasse: 'wand', name: L.wand }
	};

	function rahmen(s: ParcelState) {
		const xs = s.vertices.map((v) => v.x),
			ys = s.vertices.map((v) => v.y);
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const r = 6;
		return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r, y0, y1 };
	}
	/** Plan with north at the top: y is mirrored so the block specification stays legible. */
	function zeichnung(s: ParcelState, geaendert: string[]) {
		const r = rahmen(s);
		const y = (v: number) => r.y1 + r.y0 - v;
		const ring = (pts: [number, number][]) =>
			'M' + pts.map((p) => `${p[0].toFixed(2)} ${y(p[1]).toFixed(2)}`).join('L') + 'Z';
		const parzellen = s.parcels.map((p) => ({
			id: p.id,
			d: ring(points(s, p) as [number, number][]),
			art: p.isProtected
				? 'bestand'
				: p.use === 'commons'
					? 'hof'
					: p.use === 'passage' || p.use === 'hub'
						? 'durchgang'
						: 'privat',
			neu: geaendert.includes(p.id),
			nutzung: p.use
		}));
		const pos = new Map(s.vertices.map((v) => [v.id, [v.x, v.y] as [number, number]]));
		const kanten = s.boundary.map((e, i) => {
			const a = pos.get(e.from) ?? [0, 0],
				b = pos.get(e.to) ?? [0, 0];
			return {
				i,
				klasse: kante[e.access].klasse,
				d: `M${a[0].toFixed(2)} ${y(a[1]).toFixed(2)}L${b[0].toFixed(2)} ${y(b[1]).toFixed(2)}`
			};
		});
		return { viewBox: `${r.x} ${r.y} ${r.w} ${r.h}`, parzellen, kanten };
	}
	const plan = $derived(zeit ? zeichnung(zeit.state, zeit.geaendert) : undefined);
	const vorschauen = $derived(
		parzellenBloecke.map((b) => {
			const c = chronik(b.spec, saat, b.schutz, [epochen[0]]);
			return { id: b.id, bild: c.ok ? zeichnung(c.value[0].state, []) : undefined };
		})
	);
	const legende = $derived.by(() => {
		if (!zeit) return [];
		const klassen: Record<string, string> = {};
		for (const e of zeit.state.boundary) klassen[kante[e.access].klasse] = kante[e.access].name;
		const flaechen: [string, string][] = [
			['hof', L.hof],
			['durchgang', L.durchgang],
			['bestand', L.bestand]
		];
		const frisch: string[] = zeit.state.parcels
			.filter((p) => zeit.geaendert.includes(p.id))
			.map((p) => p.use);
		for (const n of nutzungen)
			if (frisch.includes(n.id)) flaechen.push([`n-${n.id}`, `${L.neu}: ${n.name}`]);
		return [
			...Object.entries(klassen).map(([k, n]) => ({ k, n, art: 'kante' })),
			...flaechen.map(([k, n]) => ({ k, n, art: 'flaeche' }))
		];
	});

	let host: HTMLDivElement;
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting), {
			rootMargin: '100px'
		});
		io.observe(host);
		return () => {
			io.disconnect();
			uhr.stopp();
		};
	});
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	function waehle(i: number) {
		uhr.sekunden = (i + (uhr.laeuft ? 0 : STILL)) * DAUER;
	}
	function zuruecksetzen() {
		block = START.block;
		saat = START.saat;
		uhr.sekunden = 0;
	}
</script>

<DemoLayout label="Parcels over time" onreset={zuruecksetzen}>
	{#snippet bild()}
		<div class="bild" bind:this={host}>
			<Bildleiste items={parzellenBloecke} label="Block" bind:value={block}>
				{#snippet vorschau(b)}
					{@const v = vorschauen.find((x) => x.id === b.id)?.bild}
					{#if v}
						<svg viewBox={v.viewBox} preserveAspectRatio="xMidYMid meet">
							{#each v.parzellen as p (p.id)}<path class="mini" d={p.d} />{/each}
							{#each v.kanten as k (k.i)}<path class="k {k.klasse}" d={k.d} />{/each}
						</svg>
					{/if}
				{/snippet}
			</Bildleiste>
			{#if plan}
				<svg
					class="plan"
					viewBox={plan.viewBox}
					role="img"
					aria-label="{wahl.name}, {epochen[stand.index].titel}: {plan.parzellen
						.length} areas, {plan.parzellen.filter((p) => p.neu).length} of them just changed."
				>
					{#each plan.parzellen as p (p.id)}
						<path class="p {p.art} n-{p.nutzung}" class:neu={p.neu} d={p.d} />
					{/each}
					{#each plan.kanten as k (k.i)}<path class="k {k.klasse}" d={k.d} />{/each}
				</svg>
				<ul class="legende" aria-label="Legend">
					{#each legende as l (l.k)}
						<li><span class="marke {l.art} {l.k}" aria-hidden="true"></span>{l.n}</li>
					{/each}
				</ul>
			{:else if !ergebnis.ok}
				<p class="fehler" role="status">This block cannot be split with this seed.</p>
			{/if}
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="parzellen-loop"
			label="Eras"
			phasen={epochen}
			index={stand.index}
			anteil={stand.anteil}
			laeuft={uhr.laeuft}
			onwahl={waehle}
			onumschalten={() => (uhr.laeuft = !uhr.laeuft)}
		/>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="parzellen-saat" bind:value={saat} />
		</Steuergruppe>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.plan {
		height: auto;
		max-height: 30rem;
	}
	path {
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.mini {
		fill: var(--paper);
		stroke: var(--ink-3);
		stroke-width: 0.5px;
	}
	.p {
		stroke: var(--ink-2);
		stroke-width: 1px;
		transition:
			fill var(--fast) var(--ease),
			stroke-width var(--fast) var(--ease);
	}
	.privat {
		fill: var(--paper);
	}
	.hof {
		fill: var(--cat-nature-1);
	}
	.durchgang {
		fill: var(--cat-business-1);
	}
	.bestand {
		fill: var(--paper-3);
		stroke: var(--ink-3);
	}
	.p.neu.n-living,
	.p.neu.n-mixed {
		fill: var(--cat-business-2);
	}
	.p.neu.n-work {
		fill: var(--cat-living-2);
	}
	.p.neu.n-farm {
		fill: var(--cat-nature-2);
	}
	.p.neu {
		stroke: var(--ink);
		stroke-width: 2.5px;
	}
	.k {
		fill: none;
		stroke-width: 3px;
	}
	.gasse,
	.halt {
		stroke: var(--cat-business);
	}
	.platz {
		stroke: var(--cat-business);
		stroke-width: 6px;
	}
	.halt {
		stroke-width: 6px;
		stroke-dasharray: 1 5;
	}
	.hochweg {
		stroke: var(--cat-business);
		stroke-dasharray: 6 4;
	}
	.gruen {
		stroke: var(--cat-nature);
	}
	.ufer {
		stroke: var(--cat-health);
	}
	.wand {
		stroke: var(--ink);
		stroke-width: 2px;
	}
	.legende {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	.legende li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.marke {
		display: inline-block;
		width: 1rem;
		height: 0.625rem;
	}
	.marke.kante {
		height: 0;
		border-top: 3px solid var(--ink);
	}
	.marke.kante.gasse,
	.marke.kante.platz,
	.marke.kante.halt {
		border-top-color: var(--cat-business);
	}
	.marke.kante.platz,
	.marke.kante.halt {
		border-top-width: 5px;
	}
	.marke.kante.halt {
		border-top-style: dotted;
	}
	.marke.kante.hochweg {
		border-top: 3px dashed var(--cat-business);
	}
	.marke.kante.gruen {
		border-top-color: var(--cat-nature);
	}
	.marke.kante.ufer {
		border-top-color: var(--cat-health);
	}
	.marke.kante.wand {
		border-top-width: 2px;
	}
	.marke.flaeche {
		border: var(--hair) solid var(--ink-2);
	}
	.marke.hof {
		background: var(--cat-nature-1);
	}
	.marke.durchgang {
		background: var(--cat-business-1);
	}
	.marke.bestand {
		background: var(--paper-3);
		border-color: var(--ink-3);
	}
	.marke.n-living,
	.marke.n-mixed {
		background: var(--cat-business-2);
		border: 2px solid var(--ink);
	}
	.marke.n-work {
		background: var(--cat-living-2);
		border: 2px solid var(--ink);
	}
	.marke.n-farm {
		background: var(--cat-nature-2);
		border: 2px solid var(--ink);
	}
	.fehler {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	@media (prefers-reduced-motion: reduce) {
		.p {
			transition: none;
		}
	}
</style>
