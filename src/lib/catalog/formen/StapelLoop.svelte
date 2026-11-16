<script lang="ts">
	import FormLoop from './FormLoop.svelte';
	import TraegerBuehne from './traeger/TraegerBuehne.svelte';
	import { hausStadtstueck, hausKontext } from '../logic/traeger/ensemble';
	import { umbauBei, hausBelegung } from '../logic/haus-tragwerk';
	import { stapelDauern, takt } from '../logic/formen';
	import type { Vec3 } from '../logic/traeger';
	import { stapel, stapelSchrittText } from '../data/formen';
	let t = $state(0),
		spielt = $state(true);
	const entry = hausStadtstueck(42).plaene.find((e) => e.familie === 'raumfachwerk');
	const basis = entry && 'haus' in entry ? entry.haus : undefined;
	const phase = $derived(takt(stapelDauern, t).index);
	const haus = $derived(basis ? umbauBei(basis, phase) : undefined);
	const kontext = $derived(haus ? hausKontext(haus) : { bestand: [], hochweg: [] });
	const plaene = $derived(
		haus && phase > 0
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
</script>

<FormLoop
	id={stapel.id}
	label={stapel.titel}
	schrittLabel="Lifecycle"
	schritte={stapelSchrittText}
	dauern={stapelDauern}
	bind:t
	bind:spielt
	standbild={2}
>
	<TraegerBuehne
		{plaene}
		bestand={kontext.bestand}
		hochweg={kontext.hochweg}
		figur={haus ? hausKontext(haus).figur : undefined}
		ansicht={phase === 1 ? 'geruest' : 'belegt'}
		drehbar={false}
		verhaeltnis="16 / 10"
		label="What carries, stays: take a capsule from the same building plan and insert it with a new use."
	/>
</FormLoop>
