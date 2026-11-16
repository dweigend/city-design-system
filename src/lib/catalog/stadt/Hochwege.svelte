<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Play, Pause } from 'lucide-svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Scale from '../ui/Scale.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import { hochwegBeispiele, netzUnterschrift, tragwerkBeispiel } from '../data/stadtHochwege';
	import { hochwegSzene, hochwegSchritt } from '../logic/stadt/hochwege';
	import { quartierBei, tragwerkQuartier } from '../logic/traeger/integration/hochwegnetz';
	import { TraegerBuehne } from '../formen/traeger';
	import StadtBuehne from './StadtBuehne.svelte';
	import NetzSkizze from './NetzSkizze.svelte';
	import { LoopUhr } from '../bibel/loopUhr.svelte';

	const id = $props.id();
	const quartier = tragwerkQuartier();
	const uhr = new LoopUhr(true, quartier.kanten.length * 0.8);
	/**
	 * First example: the five structural systems as nodes of the network (own stage of the structural systems).
	 * The three network examples below stay on the city stage.
	 */
	const beispiele = [tragwerkBeispiel, ...hochwegBeispiele];
	let auswahl = $state<string>(tragwerkBeispiel.value);
	let hover = $state<string>();
	let host = $state<HTMLDivElement>();
	const tragwerke = $derived(auswahl === tragwerkBeispiel.value);
	const beispiel = $derived(
		hochwegBeispiele.find((b) => b.value === auswahl) ?? hochwegBeispiele[0]
	);
	const anzahl = $derived(
		tragwerke ? quartier.kanten.length : hochwegSzene(beispiel, 0, 2).kanten.length
	);
	const schritt = $derived(hochwegSchritt(uhr.sekunden, anzahl));
	const szene = $derived(hochwegSzene(beispiel, schritt, 2, hover));
	// Twentieth steps: the network grows visibly smoothly, the stage only recomputes on change.
	const raster = $derived(Math.round(schritt * 20) / 20);
	const stand = $derived(quartierBei(quartier, raster));
	const knoten = $derived(tragwerke ? quartier.knoten : beispiel.knoten);
	const kanten = $derived(tragwerke ? stand.kanten : szene.kanten);
	$effect(() => {
		if (!tragwerke || !host) return;
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting));
		io.observe(host);
		return () => io.disconnect();
	});
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	onDestroy(() => uhr.stopp());
	function waehlen(value: string) {
		auswahl = value;
		hover = undefined;
		uhr.set(
			(value === tragwerkBeispiel.value
				? quartier.kanten.length
				: hochwegSzene(hochwegBeispiele.find((b) => b.value === value) ?? hochwegBeispiele[0], 0, 2)
						.kanten.length) * 0.8
		);
	}
	function setzen(value: number) {
		uhr.laeuft = false;
		uhr.set(value * 0.8);
	}
</script>

<DemoLayout label="Elevated walkways">
	{#snippet bild()}
		{#if tragwerke}
			<div bind:this={host}>
				<TraegerBuehne
					plaene={stand.plaene}
					bestand={quartier.bestand}
					figuren={quartier.figuren}
					ansicht="belegt"
					verhaeltnis="16 / 9"
					label={tragwerkBeispiel.bild}
				/>
			</div>
		{:else}
			<StadtBuehne
				kisten={szene.kisten}
				rahmen={{ target: [0, 1, 6], widthM: 54, heightM: 40, azimuthDeg: 18, elevationDeg: 46 }}
				label="{beispiel.label}: elevated walkways between buildings, gallery walkways at eight meters and rooftop walkways at sixteen meters"
				ratio="4 / 3"
				bind:hover
				bind:visible={uhr.sichtbar}
			/>
		{/if}
	{/snippet}
	{#snippet steuerung()}
		<div class="steuerung">
			<ChoiceControl
				id="{id}-beispiel"
				label="Example"
				items={beispiele.map((b) => ({ value: b.value, label: b.label }))}
				bind:value={() => auswahl, waehlen}
			/>
			<NetzSkizze {knoten} {kanten} bind:hover />
			<p>{tragwerke ? tragwerkBeispiel.satz : beispiel.satz}</p>
			<div class="wachstum">
				<Button variant="icon" label={uhr.laeuft ? 'Pause' : 'Play'} onclick={() => uhr.toggle()}>
					{#snippet icon()}<Icon icon={uhr.laeuft ? Pause : Play} size={16} />{/snippet}
				</Button>
				<Scale
					label="Network grows"
					bind:value={() => schritt, setzen}
					min={0}
					max={anzahl}
					step={1}
					format={(v) => String(Math.floor(v))}
				/>
			</div>
		</div>
	{/snippet}
	{#snippet unterschrift()}
		<p>{tragwerke ? tragwerkBeispiel.unterschrift : netzUnterschrift}</p>
	{/snippet}
</DemoLayout>

<style>
	.steuerung {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	p {
		margin: 0;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	.wachstum {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-4);
	}
</style>
