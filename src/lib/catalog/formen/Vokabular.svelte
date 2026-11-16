<script lang="ts">
	import BildSatz from './BildSatz.svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Scale from '../ui/Scale.svelte';
	import FormVignettes from '../scene/FormVignettes.svelte';
	import Buehne from './turm/Buehne.svelte';
	import ZellformWahl from './turm/ZellformWahl.svelte';
	import { formFamilies, formGroups, formFamily } from '../logic/parametrik/formen';
	import {
		catalogView,
		defaults,
		formOnCell,
		type CellShape
	} from '../logic/parametrik/formen/zellen';
	import type { FormGroup } from '../logic/parametrik/vocab';
	import type { SceneStyle } from '../logic/parametrik/style';
	import { formgruppen, vokabular } from '../data/formen';

	/**
	 * Vocabulary experiment: twelve form groups, each with several families. On the right group and family
	 * (vignettes), above the image the cell, below it the task of the group. Fine settings
	 * collapsible. Each family remembers its values while you browse.
	 */
	const START = { familie: 'klotz-wuerfelstapel', zelle: 'square' as CellShape, saat: 7 };
	let gewaehlt = $state(START.familie);
	let zelle = $state<CellShape>(START.zelle);
	let saat = $state(START.saat);
	let material = $state<SceneStyle['material']>('flat');
	let gemerkt = $state<Record<string, Record<string, number>>>({});
	let buehne = $state<Buehne>();
	let offen = $state('form');

	const familie = $derived(formFamily(gewaehlt) ?? formFamilies[0]);
	const params = $derived({ ...defaults(familie), ...gemerkt[familie.id] });
	const gruppenItems = formGroups.map((g) => ({ value: g.id, label: g.name }));
	const style = $derived<SceneStyle>({ level: 'detail', lines: true, material, existing: false });
	const primitives = $derived(formOnCell(familie, zelle, params, saat));
	const gruppe = $derived(formgruppen.find((g) => g.id === familie.group));
	const gruppenName = $derived(gruppe?.name ?? '');
	/** One fixed seed per family: the same on every visit, a different color sequence per family. */
	const vignettenSaat = (id: string) =>
		[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
	const vignetten = $derived([
		{
			id: familie.group,
			name: gruppenName,
			items: formFamilies
				.filter((f) => f.group === familie.group)
				.map((f) => ({
					id: f.id,
					name: f.name,
					primitives: formOnCell(f, zelle, defaults(f), vignettenSaat(f.id))
				}))
		}
	]);
	const materials = [
		{ value: 'flat', label: 'Flat' },
		{ value: 'texture', label: 'Texture' },
		{ value: 'hatch', label: 'Hatching' }
	];
	const fmt = (v: number) => Number(v.toFixed(2)).toString();

	/** Choosing a group means: show its first family. */
	function waehleGruppe(g: string) {
		const erste = formFamilies.find((f) => f.group === (g as FormGroup));
		if (erste && erste.group !== familie.group) gewaehlt = erste.id;
	}
	function reset() {
		gewaehlt = START.familie;
		zelle = START.zelle;
		saat = START.saat;
		material = 'flat';
		gemerkt = {};
		offen = 'form';
		buehne?.reset();
	}
</script>

<DemoLayout label={vokabular.titel} onreset={reset} resetLabel="Reset" bind:offen>
	{#snippet bild()}
		<div class="bild">
			<ZellformWahl bind:value={zelle} />
			<Buehne bind:this={buehne} {primitives} {style} label="{gruppenName}: {familie.name}" />
			<BildSatz name={gruppenName} text={gruppe?.satz ?? ''} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<Steuergruppe wert="form" titel="Group and form">
			<ChoiceControl
				id="vokabular-gruppe"
				label="Group"
				bind:value={() => familie.group, waehleGruppe}
				items={gruppenItems}
			/>
			<FormVignettes
				kompakt
				groups={vignetten}
				view={catalogView}
				label="Form in {gruppenName}"
				bind:value={() => familie.id, (v) => (gewaehlt = v)}
			/>
		</Steuergruppe>
		<Steuergruppe wert="fein" titel="Fine settings: {familie.name}">
			{#each familie.params as spec (familie.id + spec.key)}
				<Scale
					live
					label={spec.label}
					bind:value={
						() => params[spec.key],
						(v) => (gemerkt = { ...gemerkt, [familie.id]: { ...params, [spec.key]: v } })
					}
					min={spec.min}
					max={spec.max}
					step={spec.step}
					format={fmt}
				/>
			{/each}
			<ChoiceControl
				id="vokabular-darstellung"
				label="Rendering"
				bind:value={() => material, (v) => (material = v as SceneStyle['material'])}
				items={materials}
			/>
			<SaatZeile bind:value={saat} id="vokabular-saat" />
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
