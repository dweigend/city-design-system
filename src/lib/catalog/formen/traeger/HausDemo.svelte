<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		hausFehlerText as fehlerText,
		statikLegende,
		statikStufen
	} from '../../data/hausTragwerk';
	import DemoLayout from '../../bibel/DemoLayout.svelte';
	import Steuergruppe from '../../bibel/Steuergruppe.svelte';
	import SaatZeile from '../../bibel/SaatZeile.svelte';
	import ChoiceControl from '../../labor/ChoiceControl.svelte';
	import TraegerBuehne from './TraegerBuehne.svelte';
	import { onMount } from 'svelte';
	import { analyseArten } from '../../data/statikSkala';
	import StatikLegende from './StatikLegende.svelte';
	import { erzeugeHausRechner } from './hausRechner';
	import { bewohntesHaus, hausKontext } from '../../logic/traeger/ensemble';
	import { hausSchluessel, vorberechnet, type HausAuftrag } from '../../logic/traeger/hausAuftrag';
	import {
		analysiere,
		belegungVon,
		eigengewichtN,
		einsetzen,
		entfernen,
		nutzungSetzen,
		hausBelegung,
		type AnalyseArt,
		type Bauplan,
		type Belegung,
		type Ergebnis,
		type HausFamilie,
		type Stufe
	} from '../../logic/haus-tragwerk';
	import type { Ansicht, Vec3 } from '../../logic/traeger';
	import type { FlowId } from '../../data/focus';
	let { stapel }: { stapel: Snippet } = $props();
	let familie = $state<HausFamilie | 'stapel'>('raumfachwerk');
	let saat = $state(42),
		ansicht = $state<Ansicht>('belegt');
	let stufe = $state<Stufe>('abtrag');
	let bearbeitet = $state<Bauplan>();
	/**
	 * Occupancy of the simulated building after a conversion. It is the input of the computation: the conversion
	 * enters the queue as a job, the image only changes with the result.
	 */
	let belegung = $state.raw<Belegung>();
	let meldung = $state('');
	/** Side view across the gap: the building as a bridge between two old buildings. */
	const SEITENBLICK = { azimutRad: (70 * Math.PI) / 180, hoeheRad: (18 * Math.PI) / 180 };

	let analyseArt = $state<AnalyseArt | 'aus'>('aus');
	let offen = $state('statik');
	/** Latest result from the worker; stays in the image until the next one is finished. */
	let gerechnet = $state.raw<{ schluessel: string; haus: Bauplan }>();
	let rechnet = $state(false);
	let herkunft = $state('');
	/** Below 150 ms nothing is reported (124 R-03): short computations would only flicker. */
	const MELDESCHWELLE_MS = 150;
	let zeigtRechnen = $state(false);
	$effect(() => {
		if (!rechnet) {
			zeigtRechnen = false;
			return;
		}
		const frist = setTimeout(() => (zeigtRechnen = true), MELDESCHWELLE_MS);
		return () => clearTimeout(frist);
	});
	let rechner: ReturnType<typeof erzeugeHausRechner> | undefined;
	const familien = [
		{ value: 'raumfachwerk', label: 'Space frame' },
		{ value: 'wabe', label: 'Honeycomb' },
		{ value: 'faltwerk', label: 'Folded plate' },
		{ value: 'kuppel', label: 'Dome' },
		{ value: 'stapel', label: 'Stack groups' }
	];
	const familienName = $derived(familien.find((f) => f.value === familie)?.label ?? '');

	// The simulated building is a job: first the precomputation, otherwise the queue.
	// The other families compute nothing and are created directly.
	const auftrag = $derived<HausAuftrag | undefined>(
		familie === 'raumfachwerk'
			? { familie, saat, stufe, ...(belegung ? { belegung } : {}) }
			: undefined
	);
	const sofort = $derived.by(() => {
		if (familie === 'stapel') return undefined;
		return auftrag ? vorberechnet(auftrag)?.haus : bewohntesHaus(familie, saat);
	});
	const platzhalter = vorberechnet({ familie: 'raumfachwerk', saat: 42, stufe: 'abtrag' })?.haus;
	const original = $derived(sofort ?? (auftrag ? (gerechnet?.haus ?? platzhalter) : undefined));
	onMount(() => {
		rechner = erzeugeHausRechner();
		return () => rechner?.schliessen();
	});
	$effect(() => {
		const a = auftrag;
		if (!a || sofort) {
			rechnet = false;
			herkunft = a ? 'Computed in advance in development mode and loaded as a file.' : '';
			rechner?.abbrechen('haus');
			return;
		}
		const schluessel = hausSchluessel(a);
		if (!rechner) return;
		rechnet = true;
		void rechner.anfragen(a).then((antwort) => {
			if (antwort.status === 'veraltet') return;
			rechnet = false;
			if (antwort.status === 'fehler') {
				herkunft = `Computation aborted (${antwort.grund}). The image shows the last state.`;
				return;
			}
			const { ms, knoten, staebe } = antwort.ergebnis;
			// Seeds with equal parameters share one result; the plan names the requested seed.
			const haus = {
				...antwort.ergebnis.haus,
				saat: a.saat,
				traeger: { ...antwort.ergebnis.haus.traeger, saat: a.saat }
			};
			gerechnet = { schluessel, haus };
			herkunft = antwort.ausCache
				? 'From this session’s cache: this input has already been computed.'
				: `Computed in the background: ${zahl.format(ms)} ms for ${knoten} nodes and ${staebe} struts.`;
		});
	});
	// An edit belongs to the plan it was made on; a new seed or simulation step starts fresh.
	const haus = $derived(
		bearbeitet && bearbeitet.traeger === original?.traeger ? bearbeitet : original
	);
	const analyse = $derived(
		analyseArt === 'aus' || !haus ? undefined : analysiere(haus, analyseArt)
	);
	const zahl = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
	/** Metrics are created in the logic; here they are only set. */
	const kennzahlen = $derived.by(() => {
		const s = haus?.statik;
		if (!s) return '';
		const k = s.kennzahlen;
		const p = haus.traeger.werte;
		return [
			`Seed ${haus.saat}: gap ${zahl.format(p.lueckeM)} m, ${p.felder} bays, chord depth ${zahl.format(p.gurthoeheM)} m`,
			`${k.staebe} of ${k.kandidaten} struts`,
			`${zahl.format(k.masseKg / 1000)} t steel`,
			// Without a capsule the shoes still carry the carrier itself: never a bare "0 kN".
			`${s.lastN > 0 ? `${zahl.format(s.lastN / 1000)} kN suspended load` : 'no suspended load'}, plus ${zahl.format(eigengewichtN(s) / 1000)} kN self-weight of the carrier, on ${s.lager.length} shoes`,
			`largest compression ${zahl.format(k.groessterDruckN / 1000)} kN, largest tension ${zahl.format(k.groessterZugN / 1000)} kN`,
			`Deflection ${zahl.format(k.durchbiegungM * 1000)} mm at ${zahl.format(s.spannweiteM)} m span`
		].join(' · ');
	});
	const plaene = $derived(
		haus
			? [
					{
						haus,
						plan: { ...haus.traeger, belegung: hausBelegung(haus) },
						lage: { versatz: [0, 0, 0] as Vec3, drehungRad: 0 },
						fokus: true
					}
				]
			: []
	);
	/** Which load the shown forces apply to. */
	const lastText = $derived.by(() => {
		const b = haus?.statik?.belegung;
		if (!b) return '';
		const fest =
			'The structural system is sized for the heaviest permitted use: workshop with roof garden.';
		if (b === 'bemessung') return fest;
		const raum =
			b.raum === 'leer'
				? 'The capsule is removed, the carrier only carries itself'
				: `This view shows the current occupancy: ${b.raum === 'material' ? 'workshop' : 'housing'} ${b.garten ? 'with' : 'without'} roof garden`;
		return `${fest} ${raum}.`;
	});
	const kontext = $derived(haus ? hausKontext(haus) : { bestand: [], hochweg: [] });
	const eingang = $derived(haus ? hausKontext(haus).figur : undefined);
	function waehlen(v: string) {
		familie = v as HausFamilie | 'stapel';
		offen = familie === 'raumfachwerk' ? 'statik' : 'umbau';
		analyseArt = 'aus';
		neu();
	}
	function neu() {
		bearbeitet = undefined;
		belegung = undefined;
		meldung = '';
	}
	/** Adopts a conversion: immediately for drawn families, as a computation job for the simulated building. */
	function uebernimm(r: Ergebnis) {
		meldung = r.fehler ? fehlerText[r.fehler] : '';
		if (r.fehler) return;
		if (r.plan.statik) belegung = belegungVon(r.plan);
		else bearbeitet = r.plan;
	}
	function umbau(v: string) {
		if (!haus) return;
		const room = haus.einbauten.find(
			(e) => haus.anschluesse.find((a) => a.id === e.anschlussId)?.art === 'raum'
		);
		if (!room) return;
		uebernimm(v === 'leer' ? entfernen(haus, room.id) : nutzungSetzen(haus, room.id, v as FlowId));
	}
	function einbau(v: string) {
		if (!haus || v !== 'people') return;
		const a = haus.anschluesse.find(
			(a) => a.art === 'raum' && !haus.einbauten.some((e) => e.anschlussId === a.id)
		);
		if (a) uebernimm(einsetzen(haus, a.id, 'people'));
	}
</script>

<ChoiceControl
	id="haus-traeger"
	label="Structural family"
	items={familien}
	bind:value={() => familie, waehlen}
/>
{#if familie === 'stapel'}
	{@render stapel()}
{:else if haus}
	<DemoLayout label="Building and structural system" bind:offen>
		{#snippet bild()}
			<TraegerBuehne
				{plaene}
				leitstil={familie === 'raumfachwerk'}
				bestand={kontext.bestand}
				hochweg={kontext.hochweg}
				ansicht={analyse ? 'huelle' : ansicht}
				analyseVeraltet={zeigtRechnen}
				{analyse}
				blick={familie === 'raumfachwerk' ? SEITENBLICK : undefined}
				figur={eingang}
				label="Building on the 8 m joint, {familienName}{analyse
					? `, analysis ${analyseArten.find((a) => a.value === analyseArt)?.label}`
					: ''}"
			/>
		{/snippet}
		{#snippet steuerung()}
			<Steuergruppe wert="umbau" titel="What carries, stays">
				<ChoiceControl
					id="haus-ansicht"
					label="Rendering"
					items={[
						{ value: 'geruest', label: 'Frame' },
						{ value: 'huelle', label: 'Envelope' },
						{ value: 'belegt', label: 'Occupied' }
					]}
					bind:value={() => ansicht, (v) => (ansicht = v as Ansicht)}
				/>
				{#if haus.einbauten.some((e) => haus.anschluesse.find((a) => a.id === e.anschlussId)?.art === 'raum')}
					<ChoiceControl
						id="haus-nutzung"
						label="Module"
						items={[
							{ value: 'people', label: 'People' },
							{ value: 'material', label: 'Material' },
							{ value: 'leer', label: 'Remove' }
						]}
						bind:value={
							() =>
								haus?.einbauten.find(
									(e) => haus?.anschluesse.find((a) => a.id === e.anschlussId)?.art === 'raum'
								)?.nutzung ?? 'leer',
							umbau
						}
					/>
				{:else}
					<ChoiceControl
						id="haus-einsetzen"
						label="Module"
						items={[
							{ value: 'leer', label: 'Empty' },
							{ value: 'people', label: 'Install' }
						]}
						bind:value={() => 'leer', einbau}
					/>
				{/if}
				<p role="status">{meldung}</p>
			</Steuergruppe>
			{#if familie === 'raumfachwerk'}
				<Steuergruppe wert="statik" titel="Structural simulation">
					<ChoiceControl
						id="haus-statik"
						label="Step"
						items={statikStufen.map(({ value, label }) => ({ value, label }))}
						bind:value={
							() => stufe,
							(v) => {
								stufe = v as Stufe;
								neu();
							}
						}
					/>
					{#if haus.statik}
						<ChoiceControl
							id="haus-analyse"
							label="Analysis"
							items={analyseArten.map(({ value, label }) => ({ value, label }))}
							bind:value={() => analyseArt, (v) => (analyseArt = v as AnalyseArt | 'aus')}
						/>
					{/if}
				</Steuergruppe>
			{/if}
			<SaatZeile
				id="haus-tragwerk-saat"
				bind:value={
					() => saat,
					(v) => {
						saat = v;
						neu();
					}
				}
			/>
		{/snippet}
		{#snippet unterschrift()}
			<p role="status" class="rechenstatus">
				{zeigtRechnen ? 'Computing the structural system …' : ''}
			</p>
			<p>The joint at 8 m · gray is existing stock, ink is carrier, color is space.</p>
			{#if familie === 'raumfachwerk'}
				<p>{statikStufen.find((s) => s.value === stufe)?.text} {statikLegende}</p>
				{#if kennzahlen}<p>{kennzahlen}</p>{/if}
				{#if lastText}<p>{lastText}</p>{/if}
				{#if herkunft}<p>{herkunft}</p>{/if}
				{#if analyse}<StatikLegende {analyse} veraltet={zeigtRechnen} />{/if}
			{/if}
		{/snippet}
	</DemoLayout>
{/if}

<style>
	.rechenstatus {
		min-height: 1lh;
		margin: 0;
		color: var(--ink-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
</style>
