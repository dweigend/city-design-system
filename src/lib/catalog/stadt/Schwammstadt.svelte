<script lang="ts">
	import { onDestroy } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import StadtBuehne from './StadtBuehne.svelte';
	import LoopSteuerung from './LoopSteuerung.svelte';
	import { LoopUhr } from '../bibel/loopUhr.svelte';
	import { regen, schwammPhasen, type RegenId } from '../data/stadtBausteine';
	import { schwammAnker, schwammRahmen, schwammSzene } from '../logic/stadt/schwamm';
	import { phaseAt, phaseStart } from '../logic/stadt/zeitleiste';

	/**
	 * Sponge city in section: one rain runs through the block, phase by phase. Labels
	 * stand in place; the storage elements of the running phase are emphasized. Heavy rain shows the overflow.
	 */
	const NAMEN: Record<string, string> = {
		gruendach: 'Green roof',
		rigole: 'Gravel trench',
		becken: 'Basin',
		zisterne: 'Cistern',
		flutmulde: 'Flood swale',
		baum: 'Tree'
	};
	const BETONT: Record<string, string[]> = {
		regen: [],
		daecher: ['gruendach', 'zisterne'],
		hof: ['rigole'],
		becken: ['becken', 'flutmulde'],
		nutzen: ['zisterne', 'baum', 'gruendach']
	};

	let regenWert = $state<string>('land');
	let hover = $state<string>();
	// Without motion the still image shows the end of the first phase with water in the picture.
	const uhr = new LoopUhr(true, phaseStart(schwammPhasen, 1) + 3);
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	onDestroy(() => uhr.stopp());

	const lage = $derived(phaseAt(schwammPhasen, uhr.sekunden));
	const kisten = $derived(schwammSzene(uhr.sekunden, regenWert as RegenId, hover));
	const betont = $derived(new Set(BETONT[schwammPhasen[lage.index].id]));

	function springe(i: number) {
		uhr.set(phaseStart(schwammPhasen, i) + (uhr.laeuft ? 0 : schwammPhasen[i].durationS * 0.8));
	}
</script>

<DemoLayout label="Sponge city">
	{#snippet bild()}
		<StadtBuehne
			{kisten}
			rahmen={schwammRahmen}
			bind:hover
			bind:visible={uhr.sichtbar}
			label="Section through a block: rain falls on green roofs and an open courtyard, water collects in the gravel trench, basin and cistern."
		>
			{#snippet overlay(project)}
				{#each Object.entries(schwammAnker) as [id, p] (id)}
					{@const q = project(p)}
					{#if id !== 'flutmulde' || regenWert === 'stark'}
						<span
							class="ort"
							class:an={betont.has(id) || hover === id}
							style:left="{q.x}px"
							style:top="{q.y}px">{NAMEN[id]}</span
						>
					{/if}
				{/each}
			{/snippet}
		</StadtBuehne>
	{/snippet}

	{#snippet steuerung()}
		<ChoiceControl id="schwamm-regen" label="Rain" items={regen} bind:value={regenWert} />
		<LoopSteuerung
			id="schwamm-loop"
			label="Sequence"
			phasen={schwammPhasen}
			index={lage.index}
			local={lage.local}
			running={uhr.laeuft}
			onselect={springe}
			ontoggle={() => uhr.toggle()}
		/>
	{/snippet}

	{#snippet unterschrift()}
		<p>
			The block releases almost nothing into the sewer. It holds the water until it needs it or the
			air takes it.
		</p>
	{/snippet}
</DemoLayout>

<style>
	.ort {
		position: absolute;
		transform: translate(-50%, var(--space-1));
		padding: 0 var(--space-1);
		background: var(--paper);
		color: var(--ink-2);
		font-size: var(--text-xs);
		white-space: nowrap;
		transition: color var(--fast) var(--ease);
	}
	.ort.an {
		color: var(--ink);
		font-weight: 600;
	}
</style>
