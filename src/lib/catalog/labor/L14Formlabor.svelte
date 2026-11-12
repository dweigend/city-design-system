<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Tabs } from 'bits-ui';
	import { page } from '$app/state';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import ChoiceControl from './ChoiceControl.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import Regler from '../werkbank/Regler.svelte';
	import Button from '../ui/Button.svelte';
	import FormlaborView from '../scene/FormlaborView.svelte';
	import {
		aufstellen,
		aufstellungen,
		koepfe,
		phasen,
		regler,
		strecke,
		typen,
		type Aufstellung,
		type Genom,
		type GenomKey
	} from '../logic/parametrik/formlabor';

	const MAX = typen.length - 1;
	/** Position on the morph track: whole numbers are the types. */
	let t = $state(1),
		saat = $state(19),
		/** Manual overrides sit on top of the type and persist while morphing. */
		eingriff = $state<Partial<Genom>>({}),
		bau = $state(5),
		explosion = $state(0),
		aufstellung = $state<Aufstellung>('solo'),
		tab = $state('lage');

	const genom = $derived<Genom>({ ...strecke(t), ...eingriff });
	const staende = $derived(aufstellen(aufstellung, genom, saat, t));
	const ort = $derived.by(() => {
		const i = Math.min(MAX - 1, Math.floor(t)),
			anteil = Math.round((t - i) * 100);
		return anteil === 0
			? typen[i]
			: anteil === 100
				? typen[i + 1]
				: { ...typen[i], name: `${typen[i].name} → ${typen[i + 1].name} · ${anteil} %`, text: '' };
	});
	const eingriffe = $derived(Object.keys(eingriff).length);
	const typWahl = typen.map((x) => ({ value: x.id, label: x.name }));
	const gruppen = [
		{ id: 'lage', name: 'Position layer' },
		{ id: 'stapel', name: 'Stack' },
		{ id: 'schicht', name: 'Layer' }
	];
	const zahl = (v: number) => v.toFixed(2);
	const anzeige = (key: GenomKey) =>
		key === 'kopf'
			? (v: number) => koepfe[Math.round(v)]
			: key === 'geschosse' || key === 'breite'
				? (v: number) => v.toFixed(1)
				: zahl;
	const bauText = (v: number) => (v >= 5 ? 'complete' : `${phasen[Math.floor(v) + 1]} …`);

	// State from the URL (shareable, and this is how the contact sheets are made).
	onMount(() => {
		const q = page.url.searchParams,
			num = (name: string) => (q.has(name) ? Number(q.get(name)) : NaN);
		if (Number.isFinite(num('t'))) t = Math.max(0, Math.min(MAX, num('t')));
		if (Number.isFinite(num('saat'))) saat = Math.max(0, Math.round(num('saat')));
		if (Number.isFinite(num('bau'))) bau = Math.max(0, Math.min(5, num('bau')));
		if (Number.isFinite(num('explosion'))) explosion = Math.max(0, Math.min(1, num('explosion')));
		const art = q.get('szene');
		if (art === 'solo' || art === 'trio' || art === 'reihe') aufstellung = art;
		const vor: Partial<Genom> = {};
		for (const r of regler)
			if (Number.isFinite(num(r.key))) vor[r.key] = Math.max(r.min, Math.min(r.max, num(r.key)));
		if (Object.keys(vor).length) eingriff = vor;
	});

	let lauf = 0;
	function spiele(dauer: number, schritt: (k: number) => void) {
		cancelAnimationFrame(lauf);
		const start = performance.now();
		const tick = (jetzt: number) => {
			const k = Math.min(1, (jetzt - start) / dauer);
			schritt(k);
			if (k < 1) lauf = requestAnimationFrame(tick);
		};
		lauf = requestAnimationFrame(tick);
	}
	onDestroy(() => {
		if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(lauf);
	});
</script>

<div class="formlabor">
	<DemoLayout label="Form lab" offen="form">
		{#snippet bild()}
			<FormlaborView {staende} {bau} {explosion} label="L14 · Form lab" />
		{/snippet}
		{#snippet steuerung()}
			<Steuergruppe wert="form" titel="Form and arrangement">
				<div class="breit">
					<ChoiceControl
						id="L14-typ"
						label="Type"
						bind:value={
							() => (Number.isInteger(t) ? typen[t].id : ''),
							(v) => {
								const i = typen.findIndex((x) => x.id === v);
								if (i >= 0) {
									t = i;
									eingriff = {};
								}
							}
						}
						items={typWahl}
					/>
				</div>
				<Regler label="Morph track" bind:value={t} min={0} max={MAX} step={0.01} format={zahl} />
				<SaatZeile bind:value={saat} id="L14-saat" />
				<ChoiceControl
					id="L14-szene"
					label="Arrangement"
					bind:value={() => aufstellung, (v) => (aufstellung = v as Aufstellung)}
					items={aufstellungen}
				/>
			</Steuergruppe>
			<Steuergruppe wert="masse" titel="Dimensions">
				<div class="breit">
					<Tabs.Root bind:value={tab}>
						<Tabs.List class="tab-list" aria-label="Tower dimensions">
							{#each gruppen as g (g.id)}<Tabs.Trigger value={g.id} class="tab"
									>{g.name}</Tabs.Trigger
								>{/each}
						</Tabs.List>
						{#each gruppen as g (g.id)}
							<Tabs.Content value={g.id} class="tab-body">
								{#each regler.filter((r) => r.gruppe === g.id) as r (r.key)}
									<Regler
										label={r.name + (r.key in eingriff ? ' ·' : '')}
										bind:value={
											() => genom[r.key],
											(v) => {
												// The slider snaps foreign values to its step: that is not an override.
												if (Math.abs(v - genom[r.key]) > r.step * 0.51)
													eingriff = { ...eingriff, [r.key]: v };
											}
										}
										min={r.min}
										max={r.max}
										step={r.step}
										format={anzeige(r.key)}
									/>
								{/each}
							</Tabs.Content>
						{/each}
					</Tabs.Root>
				</div>
			</Steuergruppe>
			<Steuergruppe wert="aufbau" titel="Assembly and motion">
				<Regler
					label="Construction phase"
					bind:value={bau}
					min={0}
					max={5}
					step={0.01}
					format={bauText}
				/>
				<Regler
					label="Explosion"
					bind:value={explosion}
					min={0}
					max={1}
					step={0.01}
					format={zahl}
				/>
				<div class="breit knoepfe">
					<Button
						variant="secondary"
						label="Play assembly"
						onclick={() => spiele(7000, (k) => (bau = k * 5))}
					/>
					<Button
						variant="secondary"
						label="Play morph"
						onclick={() => {
							eingriff = {};
							spiele(28000, (k) => (t = k * MAX));
						}}
					/>
					<Button
						variant="secondary"
						label={eingriffe ? `Clear overrides (${eingriffe})` : 'Clear overrides'}
						disabled={!eingriffe}
						onclick={() => (eingriff = {})}
					/>
				</div>
			</Steuergruppe>
		{/snippet}
	</DemoLayout>
	<p class="ort" aria-live="polite">
		<b>{ort.name}</b>
		{#if ort.text}<span>{ort.text}</span><span class="ref">Ref. {ort.ref}</span>{/if}
	</p>
</div>

<style>
	.formlabor {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	/* Span the full width in the two-column (narrow) control panel. */
	.breit {
		grid-column: 1 / -1;
		min-width: 0;
	}
	.breit :global(.tab-list) {
		display: flex;
		border-bottom: var(--hair) solid var(--line);
	}
	.breit :global(.tab) {
		flex: 1;
		padding: var(--space-2) 0;
		font: var(--text-xs) var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-2);
		background: none;
		border: 0;
		border-bottom: var(--stroke) solid transparent;
		margin-bottom: -1px;
		cursor: pointer;
	}
	.breit :global(.tab[data-state='active']) {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}
	.breit :global(.tab:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	.breit :global(.tab-body[hidden]) {
		display: none;
	}
	.breit :global(.tab-body) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-4);
	}
	.knoepfe {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.knoepfe :global(.cg-button) {
		width: 100%;
	}
	.ort {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.ort b {
		color: var(--ink);
		font-weight: 600;
	}
	.ref {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
</style>
