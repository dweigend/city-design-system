<script lang="ts">
	import BildSatz from '../BildSatz.svelte';
	import { onMount } from 'svelte';
	import DemoLayout from '../../bibel/DemoLayout.svelte';
	import Steuergruppe from '../../bibel/Steuergruppe.svelte';
	import SaatZeile from '../../bibel/SaatZeile.svelte';
	import ChoiceControl from '../../labor/ChoiceControl.svelte';
	import Scale from '../../ui/Scale.svelte';
	import FormVignettes from '../../scene/FormVignettes.svelte';
	import Buehne from './Buehne.svelte';
	import ZellformWahl from './ZellformWahl.svelte';
	import AufbauLeiste from './AufbauLeiste.svelte';
	import { formFamilies, formFamily, formGroups } from '../../logic/parametrik/formen';
	import {
		catalogView,
		defaults,
		formOnCell,
		testCells,
		type CellShape
	} from '../../logic/parametrik/formen/zellen';
	import { funktionen, type FunktionId } from '../../logic/parametrik/eckraster/funktion';
	import type { SceneStyle } from '../../logic/parametrik/style';
	import type { Primitive, Vec3 } from '../../logic/parametrik/types';
	import type { FormGroup } from '../../logic/parametrik/vocab';
	import {
		GESCHOSSE,
		PHASEN,
		ZONEN,
		bisPhase,
		freieParameter,
		mitFamilie,
		mitFunktion,
		mitGeschossen,
		mitGruppe,
		mitParameter,
		parameterVon,
		phaseVon,
		startWahl,
		turm,
		turmAnsicht,
		weich,
		zonenFamilien,
		zonenGruppen,
		zonenRahmen,
		type Phase,
		type TurmWahl,
		type Zone
	} from '../../logic/formen';
	import { kopfTraegtNicht, phasenText, zonenText } from '../../data/turm';

	/**
	 * Central Forms simulation: a tower on a cell. On the right zone, group, family and
	 * function; above the image the cell shape, below it the build-up. Fine settings collapsible.
	 * State is the choice (logic/formen/turm.ts); changes only via its actions.
	 */
	let {
		wahl = $bindable(structuredClone(startWahl)),
		zelle = $bindable<CellShape>('square'),
		phase = $bindable<Phase>('weg')
	}: { wahl?: TurmWahl; zelle?: CellShape; phase?: Phase } = $props();

	let zone = $state<Zone>('stapel');
	let offen = $state('bauteil');
	let material = $state<SceneStyle['material']>('flat');
	/** Each family remembers its values while you browse. */
	let gemerkt = $state<Record<string, Record<string, number>>>({});
	let buehne = $state<Buehne>();

	const modell = $derived(turm(wahl, { polygon: testCells[zelle].polygon }));
	const fertig = $derived(phase === 'weg');
	const style = $derived<SceneStyle>({ level: 'detail', lines: true, material, existing: false });
	const ansicht = $derived(turmAnsicht(modell.hoehe.gesamt));

	/* ── Play build-up ── */
	const TAKT = 0.95,
		FALL = 0.7,
		HOEHE = 9;
	let spielt = $state(false);
	let fall = $state<{ gruppe: Phase; z: number } | null>(null);
	const ruhig =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	let frame = 0;
	function anhalten() {
		cancelAnimationFrame(frame);
		spielt = false;
		fall = null;
	}
	function spielen() {
		if (spielt) return anhalten();
		spielt = true;
		phase = 'zelle';
		let t0 = performance.now(),
			k = 0;
		const schritt = (now: number) => {
			const t = (now - t0) / 1000;
			const ziel = Math.min(PHASEN.length - 1, Math.floor(t / TAKT));
			if (ziel !== k) {
				k = ziel;
				phase = PHASEN[k];
			}
			const p = (t - k * TAKT) / FALL;
			fall = ruhig || k === 0 || p >= 1 ? null : { gruppe: PHASEN[k], z: HOEHE * (1 - weich(p)) };
			if (k === PHASEN.length - 1 && p >= 1) return anhalten();
			frame = requestAnimationFrame(schritt);
		};
		t0 = performance.now();
		frame = requestAnimationFrame(schritt);
	}
	onMount(() => () => cancelAnimationFrame(frame));

	const offsets = $derived(
		new Map<string, Vec3>(fall ? [[fall.gruppe, [0, 0, fall.z] as Vec3]] : [])
	);
	const groupOf = (p: Primitive) => phaseVon(p.id) ?? 'zelle';

	const primitives = $derived([
		...bisPhase(modell, phase),
		...(fertig && !spielt ? zonenRahmen(modell, zone) : [])
	]);

	/* ── Selection ── */
	const zonenItems = ZONEN.map((z) => ({ value: z, label: zonenText[z].label }));
	const gruppe = $derived(formFamily(wahl[zone].familie)?.group ?? zonenGruppen[zone][0]);
	const gruppenItems = $derived(
		zonenGruppen[zone].map((g) => ({
			value: g,
			label: formGroups.find((x) => x.id === g)?.name ?? g
		}))
	);
	const gruppenName = $derived(formGroups.find((g) => g.id === gruppe)?.name ?? '');
	const vignetten = $derived([
		{
			id: `${zone}-${gruppe}`,
			name: gruppenName,
			items: zonenFamilien(zone, gruppe).flatMap((id) => {
				const f = formFamily(id);
				return f ? [{ id, name: f.name, primitives: formOnCell(f, 'square', defaults(f), 7) }] : [];
			})
		}
	]);
	const funktionItems = funktionen.map((f) => ({ value: f.id, label: f.label }));

	const familie = $derived(formFamily(wahl[zone].familie) ?? formFamilies[0]);
	const params = $derived(parameterVon(wahl, zone));

	function merken() {
		gemerkt = { ...gemerkt, [wahl[zone].familie]: { ...params } };
	}
	function waehleFamilie(id: string) {
		merken();
		wahl = mitFamilie(wahl, zone, id, gemerkt[id]);
		phase = 'weg';
	}
	function waehleGruppe(g: string) {
		merken();
		wahl = mitGruppe(wahl, zone, g as FormGroup, (id) => gemerkt[id]);
		phase = 'weg';
	}
	function waehleZone(z: string) {
		zone = z as Zone;
		phase = 'weg';
	}
	function waehleFunktion(id: string) {
		wahl = mitFunktion(wahl, id as FunktionId);
	}
	function pick(id: string | undefined) {
		const p = id ? phaseVon(id) : undefined;
		if (p && (ZONEN as string[]).includes(p)) {
			zone = p as Zone;
			offen = 'bauteil';
		}
	}

	const satz = $derived(
		!fertig || spielt
			? phasenText[phase].satz
			: !modell.kopfGueltig
				? formFamily(wahl.stapel.familie)?.group === 'kapsel'
					? 'The capsule has no flat roof bearing. The garden crown is not inserted.'
					: kopfTraegtNicht
				: zonenText[zone].satz
	);
	const phasenItems = PHASEN.map((p) => ({ id: p, label: phasenText[p].label }));
	const materials = [
		{ value: 'flat', label: 'Flat' },
		{ value: 'texture', label: 'Texture' },
		{ value: 'hatch', label: 'Hatching' }
	];
	const fmt = (v: number) => Number(v.toFixed(2)).toString();

	function reset() {
		anhalten();
		wahl = structuredClone(startWahl);
		gemerkt = {};
		zelle = 'square';
		phase = 'weg';
		zone = 'stapel';
		material = 'flat';
		offen = 'bauteil';
		buehne?.reset();
	}
</script>

<DemoLayout label="Tower on the cell" onreset={reset} resetLabel="Reset" bind:offen>
	{#snippet bild()}
		<div class="bild">
			<ZellformWahl bind:value={zelle} />
			<Buehne
				bind:this={buehne}
				{primitives}
				{style}
				view={ansicht}
				{groupOf}
				{offsets}
				onpick={pick}
				label="Tower on a cell: plinth, stack, crown and stair. A click on a part selects its zone."
			/>
			<AufbauLeiste
				phasen={phasenItems}
				bind:value={() => phase, (v) => ((phase = v as Phase), anhalten())}
				{spielt}
				onspielen={spielen}
			/>
			<BildSatz text={satz} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<Steuergruppe wert="bauteil" titel="Zone, form, function">
			<ChoiceControl
				id="turm-zone"
				label="Zone"
				items={zonenItems}
				bind:value={() => zone, waehleZone}
			/>
			<ChoiceControl
				id="turm-gruppe"
				label="Group"
				items={gruppenItems}
				bind:value={() => gruppe, waehleGruppe}
			/>
			<FormVignettes
				kompakt
				groups={vignetten}
				view={catalogView}
				label="Family in {gruppenName}"
				bind:value={() => wahl[zone].familie, waehleFamilie}
			/>
			<ChoiceControl
				id="turm-funktion"
				label="Function"
				items={funktionItems}
				bind:value={() => wahl.funktion, waehleFunktion}
			/>
		</Steuergruppe>
		<Steuergruppe wert="fein" titel="Fine settings: {familie.name}">
			<Scale
				live
				label="Floors in the stack"
				bind:value={() => wahl.geschosse, (v) => (wahl = mitGeschossen(wahl, v))}
				min={GESCHOSSE.min}
				max={GESCHOSSE.max}
				step={1}
			/>
			{#each freieParameter(familie.id) as spec (familie.id + spec.key)}
				<Scale
					live
					label={spec.label}
					bind:value={() => params[spec.key], (v) => (wahl = mitParameter(wahl, zone, spec.key, v))}
					min={spec.min}
					max={spec.max}
					step={spec.step}
					format={fmt}
				/>
			{/each}
			<ChoiceControl
				id="turm-darstellung"
				label="Rendering"
				bind:value={() => material, (v) => (material = v as SceneStyle['material'])}
				items={materials}
			/>
			<SaatZeile
				bind:value={() => wahl.seed, (v) => (wahl = { ...wahl, seed: v })}
				id="turm-saat"
			/>
		</Steuergruppe>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
