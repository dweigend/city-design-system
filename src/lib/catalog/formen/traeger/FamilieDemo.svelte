<script lang="ts">
	import { onMount } from 'svelte';
	import { Collapsible } from 'bits-ui';
	import DemoLayout from '../../bibel/DemoLayout.svelte';
	import Steuergruppe from '../../bibel/Steuergruppe.svelte';
	import SaatZeile from '../../bibel/SaatZeile.svelte';
	import LoopSchritte from '../../bibel/LoopSchritte.svelte';
	import { LoopUhr } from '../../bibel/loopUhr.svelte';
	import ChoiceControl from '../../labor/ChoiceControl.svelte';
	import Scale from '../../ui/Scale.svelte';
	import TraegerBuehne from './TraegerBuehne.svelte';
	import {
		familie as holeFamilie,
		planen,
		loopZustand,
		loopZiel,
		type FamilieId,
		type Ansicht
	} from '../../logic/traeger';
	import type { FamilienText } from '../../data/traeger';
	let { familie, texte }: { familie: FamilieId; texte: FamilienText } = $props();
	const f = $derived(holeFamilie(familie));
	const uhr = new LoopUhr();
	let host: HTMLElement;
	let saat = $state(42),
		manuell = $state<Record<string, number> | undefined>(),
		wahl = $state<Ansicht | undefined>(),
		gewaehlterSchritt = $state<number | undefined>();
	const zustand = $derived(loopZustand(f, uhr.sekunden));
	const standbild = $derived(!uhr.laeuft && manuell === undefined);
	const werte = $derived(manuell ?? (standbild ? loopZiel(f, f.loop.length - 1) : zustand.werte));
	const plan = $derived(planen(familie, werte, saat));
	const ansicht = $derived(
		wahl ?? (standbild ? f.loop[f.loop.length - 1].ansicht : zustand.ansicht)
	);
	const schritt = $derived(standbild ? f.loop.length - 1 : (gewaehlterSchritt ?? zustand.schritt));
	const plaene = $derived([
		{ plan, lage: { versatz: [0, 0, 0] as [number, number, number], drehungRad: 0 }, fokus: true }
	]);
	const phasen = $derived(
		texte.schritte.map((s, i) => ({ id: String(i), titel: s.name, text: '' }))
	);
	function stop() {
		const snapshot = { werte: { ...werte }, ansicht, schritt };
		gewaehlterSchritt = snapshot.schritt;
		uhr.laeuft = false;
		manuell = snapshot.werte;
		wahl = snapshot.ansicht;
	}
	function set(id: string, v: number) {
		const parameter = f.parameter.find((p) => p.id === id);
		// Sliders normalize their initial thumb to the step grid. Keep the exact loop target
		// until an input moves by at least half a step (notably irrational radian limits).
		const toleranz = parameter?.art === 'stetig' ? parameter.schritt / 2 + 1e-9 : 1e-9;
		if (Math.abs(v - werte[id]) < toleranz) return;
		stop();
		manuell = { ...werte, [id]: v };
	}
	function step(i: number) {
		gewaehlterSchritt = i;
		manuell = loopZiel(f, i);
		wahl = f.loop[i].ansicht;
		uhr.laeuft = false;
		uhr.set(f.loop.slice(0, i).reduce((s, v) => s + v.dauerS, 0));
	}
	function toggle() {
		gewaehlterSchritt = undefined;
		if (!uhr.laeuft) {
			manuell = undefined;
			wahl = undefined;
		}
		uhr.toggle();
	}
	$effect(() => uhr.abgleichen());
	onMount(() => {
		// RadioGroup emits value changes only: a click on the active step must also pause at its target.
		const clickStep = (event: MouseEvent) => {
			const radio = event.target instanceof Element ? event.target.closest('[role="radio"]') : null;
			const group = radio?.closest('[role="radiogroup"]');
			if (radio && group?.getAttribute('aria-labelledby') === `${familie}-loop`)
				step(Array.from(group.querySelectorAll('[role="radio"]')).indexOf(radio));
		};
		host.addEventListener('click', clickStep);
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting));
		io.observe(host);
		return () => {
			io.disconnect();
			host.removeEventListener('click', clickStep);
			uhr.stopp();
		};
	});
</script>

<section bind:this={host} id={`traeger-${familie}`}>
	<h2>{texte.titel}</h2>
	<p class="lead">{texte.lead}</p>
	<DemoLayout label={`Control ${texte.name}`} offen="haupt">
		{#snippet bild()}<TraegerBuehne
				{plaene}
				{ansicht}
				label={texte.name}
				verhaeltnis="3 / 1"
			/>{/snippet}
		{#snippet steuerung()}
			<Steuergruppe wert="haupt" titel={texte.name}>
				{#each f.parameter.filter((p) => !p.verborgen) as p (p.id)}
					{#if p.art === 'diskret'}<ChoiceControl
							id={`${familie}-${p.id}`}
							label={p.label}
							items={p.optionen.map((o) => ({ value: String(o.wert), label: o.label }))}
							bind:value={() => String(werte[p.id]), (v) => set(p.id, Number(v))}
						/>
					{:else}<Scale
							label={p.label}
							min={p.min}
							max={p.max}
							step={p.schritt}
							live
							bind:value={() => werte[p.id], (v) => set(p.id, v)}
							format={(v) => `${v.toFixed(2)}${p.einheit ? ' ' + p.einheit : ''}`}
						/>{/if}
				{/each}
			</Steuergruppe>
			<Steuergruppe wert="ansicht" titel="View">
				<ChoiceControl
					id={`${familie}-ansicht`}
					label="Rendering"
					items={[
						{ value: 'geruest', label: 'Frame' },
						{ value: 'huelle', label: 'Envelope' },
						{ value: 'belegt', label: 'Occupied' }
					]}
					bind:value={
						() => ansicht,
						(v) => {
							stop();
							wahl = v as Ansicht;
						}
					}
				/>
				<SaatZeile
					id={`${familie}-saat`}
					bind:value={
						() => saat,
						(v) => {
							stop();
							saat = v;
						}
					}
				/>
			</Steuergruppe>
		{/snippet}
		{#snippet unterschrift()}
			<div class="loop-nav">
				<LoopSchritte
					id={`${familie}-loop`}
					label="Build-up"
					{phasen}
					index={schritt}
					anteil={standbild || gewaehlterSchritt !== undefined ? 1 : zustand.anteil}
					laeuft={uhr.laeuft}
					onwahl={step}
					onumschalten={toggle}
				/>
			</div>
			<p>{texte.schritte[schritt]?.satz}</p>
			<Collapsible.Root
				><Collapsible.Trigger class="vertiefung">Deep dive and references</Collapsible.Trigger
				><Collapsible.Content
					><p>{texte.vertiefung}</p>
					<p>{texte.vorbilder}</p></Collapsible.Content
				></Collapsible.Root
			>
		{/snippet}
	</DemoLayout>
</section>

<style>
	section {
		margin-block: var(--space-6);
	}
	h2 {
		font-size: var(--text-l);
		font-weight: 500;
		margin-bottom: var(--space-3);
	}
	.lead {
		max-width: 70ch;
		color: var(--ink-2);
		margin-bottom: var(--space-4);
	}
	p {
		line-height: 1.5;
	}
	:global(.vertiefung) {
		font: inherit;
		color: var(--ink-2);
		background: none;
		border: 0;
		border-bottom: var(--hair) solid var(--line);
		padding: var(--space-2) 0;
		cursor: pointer;
	}
	:global(.vertiefung:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.loop-nav :global(.schritte) {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.loop-nav :global(.schritt) {
		padding-block: var(--space-2);
		grid-template-columns: auto 1fr;
		gap: var(--space-1);
	}
	.loop-nav :global(.text:empty) {
		display: none;
	}
	@media (max-width: 720px) {
		.loop-nav :global(.schritt) {
			min-height: 44px;
		}
	}
</style>
