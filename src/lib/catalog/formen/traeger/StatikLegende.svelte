<script lang="ts">
	import { analyseArten } from '../../data/statikSkala';
	import type { Analyse } from '../../logic/haus-tragwerk';

	/**
	 * Legend of the analysis view (124 A-06), built like an FEM plot: title as a sentence with
	 * unit, stepped bar, class limits in mono digits, below it the extreme values.
	 * Stands below the image, never in the canvas. `veraltet`: dashed until the new result is there.
	 */
	let { analyse, veraltet = false }: { analyse: Analyse; veraltet?: boolean } = $props();
	const art = $derived(analyseArten.find((a) => a.value === analyse.art) ?? analyseArten[1]);
	// Display in kN, percent and millimeters; the logic computes in N, shares and meters.
	const faktor = $derived(
		analyse.art === 'kraft' ? 1e-3 : analyse.art === 'ausnutzung' ? 100 : 1e3
	);
	const zahl = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
	const wert = (v: number) => zahl.format(v * faktor);
	const einheit = $derived(art.einheit === '%' ? '%' : ` ${art.einheit}`);
	// Each class names its range; compression and tension become readable as named magnitudes.
	const bereich = (von: number, bis: number) => {
		if (analyse.art === 'kraft') {
			if (von < 0 && bis > 0) return `−${wert(bis)} to +${wert(bis)} kN`;
			const druck = bis <= 0;
			const klein = druck ? -bis : von;
			const gross = druck ? -von : bis;
			const name = druck ? 'Compression' : 'Tension';
			return Number.isFinite(gross)
				? `${name} ${wert(klein)}–${wert(gross)} kN`
				: `${name} ≥ ${wert(klein)} kN`;
		}
		return Number.isFinite(bis)
			? `${wert(von)}–${wert(bis)}${einheit}`
			: `≥ ${wert(von)}${einheit}`;
	};
	const titel = $derived(
		analyse.art === 'kraft'
			? 'Axial force in kN, largest force per strut from all load cases. Teal pulls, violet pushes.'
			: analyse.art === 'ausnutzung'
				? 'Utilization in %, share of the load-bearing capacity. 100% is the limit.'
				: `Total displacement in mm under service load, exaggerated ${zahl.format(analyse.ueberhoehung)} times. The hairlines show the undeformed position. Deflection, by contrast, denotes the relative sag between the supports.`
	);
	const belegteKlassen = $derived(new Set(analyse.strecken.map((strecke) => strecke.klasse)));
	const extrem = $derived(
		analyse.art === 'kraft'
			? `Largest tension ${wert(Math.max(0, analyse.groesster))} kN, largest compression ${wert(Math.max(0, -analyse.kleinster))} kN.`
			: `Largest value ${wert(analyse.groesster)}${einheit}.`
	);
</script>

<figure class="legende" class:veraltet>
	<figcaption>{veraltet ? 'Outdated. ' : ''}{titel}</figcaption>
	<ol>
		{#each analyse.klassen as klasse, index (klasse.token + klasse.von)}
			<li>
				<span class="farbe" style:background="var({klasse.token})"></span>
				<span class="wert">{bereich(klasse.von, klasse.bis)}</span>
				<span class="wert">{belegteKlassen.has(index) ? 'in the image' : 'not in the image'}</span>
			</li>
		{/each}
	</ol>
	<p>{extrem}</p>
</figure>

<style>
	.legende {
		margin: var(--space-2) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--ink-2);
	}
	.legende.veraltet {
		border-top: var(--hair) dashed var(--ink-3);
		padding-top: var(--space-2);
	}
	.legende.veraltet .farbe {
		opacity: var(--alpha-trace);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-2) var(--space-3);
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.farbe {
		height: var(--bar);
	}
	.wert {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	p {
		margin: 0;
	}
</style>
