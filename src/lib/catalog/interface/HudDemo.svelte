<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import HudBild from './HudBild.svelte';
	import { focusModes, type FocusModeId } from '../data/focus';
	import { hudMuster, type HudModus } from '../data/interface';

	/**
	 * HUD Play and Plan: image on the left, on the right mode, focus mode and the patterns as a
	 * numbered legend. The numbers stand in the image at the pattern; only visible patterns count.
	 */
	let modus = $state<HudModus>('play');
	let fokus = $state<FocusModeId>('versorgung');

	const sichtbar = $derived(hudMuster.filter((m) => m.modi.includes(modus)));
	const nummer = $derived((id: string) => {
		const i = sichtbar.findIndex((m) => m.id === id);
		return i < 0 ? undefined : i + 1;
	});
	const modusItems = [
		{ value: 'play', label: 'Play' },
		{ value: 'plan', label: 'Plan' }
	];
	const fokusItems = focusModes.map((m) => ({ value: m.id, label: m.name }));
	const frage = $derived(focusModes.find((m) => m.id === fokus)?.question ?? '');

	function zuruecksetzen() {
		modus = 'play';
		fokus = 'versorgung';
	}
</script>

<DemoLayout label="HUD" onreset={zuruecksetzen} offen="hud">
	{#snippet bild()}
		<div
			role="img"
			aria-label="HUD in {modus === 'play'
				? 'Play'
				: 'Plan'} mode: district with four old buildings around a courtyard, above it metrics, tools, focus modes and timeline."
		>
			<HudBild {modus} {fokus} {nummer} />
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="hud" titel="Mode and patterns">
			<ChoiceControl
				id="hud-modus"
				label="Mode"
				bind:value={() => modus, (v) => (modus = v as HudModus)}
				items={modusItems}
			/>
			<ChoiceControl
				id="hud-fokus"
				label="Focus mode"
				bind:value={() => fokus, (v) => (fokus = v as FocusModeId)}
				items={fokusItems}
			/>
			<ol class="muster" aria-label="Patterns in the image">
				{#each sichtbar as m, i (m.id)}
					<li>
						<span class="nr" aria-hidden="true">{i + 1}</span>
						<span><b>{m.name}.</b> {m.text}</span>
					</li>
				{/each}
			</ol>
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p aria-live="polite">
			{#if modus === 'play'}
				<b>Play.</b> The question “{frage}” colors its flows, the existing stock stays line.
			{:else}
				<b>Plan.</b> Everything in blueprint is a draft. The new module snaps dashed onto the building,
				the inventory shows what deconstruction supplies for it.
			{/if}
		</p>
	{/snippet}
</DemoLayout>

<style>
	.muster {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-3) 0 0;
		list-style: none;
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-s);
		line-height: 1.45;
		color: var(--ink-2);
	}
	li {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		gap: var(--space-3);
		align-items: start;
	}
	b {
		color: var(--ink);
		font-weight: 600;
	}
	.nr {
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		margin-top: 1px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}
</style>
