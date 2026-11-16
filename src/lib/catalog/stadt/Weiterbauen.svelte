<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import StadtBuehne from './StadtBuehne.svelte';
	import EingriffListe from './EingriffListe.svelte';
	import { LoopUhr } from '../bibel/loopUhr.svelte';
	import { eingriffe, lagen, stufen, type LageId, type StufeId } from '../data/stadtBausteine';
	import { anker, weiterbauenRahmen, weiterbauenSzene } from '../logic/stadt/weiterbauen';
	import { smooth } from '../logic/stadt/zeitleiste';
	import { Pause, Play } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';

	/**
	 * Building on existing stock as a small city: choose a starting situation, then step by step Retain,
	 * Convert, Extend. On first view the sequence runs once on its own; any interaction
	 * takes over. On the right it says what the step means in this situation; pointing links list and image.
	 */
	const WACHSEN_S = 1.4;
	const HALTEN_S = 2.6;

	let lageWert = $state<string>('zeile');
	let stufeWert = $state<string>('behalten');
	const lage = $derived(lageWert as LageId);
	const stufe = $derived(stufeWert as StufeId);
	let hover = $state<string>();
	let auto = $state(true);
	let seit = $state(0);
	/** Step the demonstration set last; any other change comes from the reader. */
	let autoSchritt = 'behalten';
	let lageVorher = 'zeile';

	const uhr = new LoopUhr();
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	onDestroy(() => uhr.stopp());

	const index = $derived(stufen.findIndex((s) => s.value === stufe));
	const f = $derived(uhr.laeuft ? smooth((uhr.sekunden - seit) / WACHSEN_S) : 1);

	// First demonstration: once through all three steps, then rest.
	$effect(() => {
		if (!auto || !uhr.laeuft) return;
		if (index === stufen.length - 1) auto = false;
		else if (uhr.sekunden - seit > WACHSEN_S + HALTEN_S) {
			autoSchritt = stufen[index + 1].value;
			stufeWert = autoSchritt;
		}
	});

	// Every change restarts the growth; a change by the reader ends the demonstration.
	$effect(() => {
		const l = lageWert,
			st = stufeWert;
		untrack(() => {
			if (l !== lageVorher || st !== autoSchritt) auto = false;
			lageVorher = l;
			seit = uhr.sekunden;
		});
	});

	const kisten = $derived(weiterbauenSzene(lage, index, f, uhr.sekunden, hover));
	const rahmen = $derived(weiterbauenRahmen(lage));
	const punkte = $derived(anker(lage));
	const alle = $derived(Object.values(eingriffe[lage]).flat());
	const aktiv = $derived(alle.find((e) => e.target === hover));
</script>

<DemoLayout label="Building on existing stock">
	{#snippet bild()}
		<StadtBuehne
			{kisten}
			{rahmen}
			bind:hover
			bind:visible={uhr.sichtbar}
			onpick={(t) => (hover = t)}
			label="A piece of city. Gray is existing stock, color is what is converted or extended."
		>
			{#snippet overlay(project)}
				{#if aktiv && punkte[aktiv.target]}
					{@const p = project(punkte[aktiv.target])}
					<span class="marke" style:left="{p.x}px" style:top="{p.y}px">{aktiv.titel}</span>
				{/if}
			{/snippet}
		</StadtBuehne>
	{/snippet}

	{#snippet steuerung()}
		<div class="kopf">
			<ChoiceControl id="wb-lage" label="Starting situation" items={lagen} bind:value={lageWert} />
			<Button
				variant="icon"
				label={uhr.laeuft ? 'Pause motion' : 'Play motion'}
				onclick={() => uhr.toggle()}
				aria-pressed={uhr.laeuft}
			>
				{#snippet icon()}<Icon icon={uhr.laeuft ? Pause : Play} size={16} />{/snippet}
			</Button>
		</div>
		<div class="schritt">
			<ChoiceControl id="wb-stufe" label="Step" items={stufen} bind:value={stufeWert} />
			<p>{stufen[index].text}</p>
		</div>
		<EingriffListe items={eingriffe[lage][stufe]} bind:hover />
	{/snippet}

	{#snippet unterschrift()}
		<p>Point at a building or an entry on the right to see what happens where.</p>
	{/snippet}
</DemoLayout>

<style>
	/* Pause belongs to the scene: next to the main choice, so it is always reachable. */
	.kopf {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.schritt {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.schritt p {
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	.marke {
		position: absolute;
		transform: translate(-50%, calc(-100% - var(--space-2)));
		padding: var(--space-1) var(--space-2);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
</style>
