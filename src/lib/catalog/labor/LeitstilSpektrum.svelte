<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { onMount } from 'svelte';
	import { ZOOM, MODI, SITUATIONEN, type Zoom, type Modus, type Situation } from '../data/leitstil';
	import { pruefszene } from '../data/leitstilPruefszene';
	import { stilFuer } from '../logic/leitstil';
	import { zeichneSzene } from '../scene/leitstil';
	import { theme } from '../theme';
	let zoom = $state<Zoom>('haus'),
		modus = $state<Modus>('ansehen'),
		situation = $state<Situation>('normal');
	let host: HTMLDivElement;
	let breite = $state(1000);
	let bereit = $state(false),
		fehler = $state('');
	const namen: Record<string, string> = {
		stadt: 'City',
		quartier: 'District',
		haus: 'Building',
		nah: 'Close-up',
		ansehen: 'View',
		auswaehlen: 'Select',
		bauen: 'Build',
		wege: 'Paths',
		versorgung: 'Supply',
		ernte: 'Harvest',
		rueckbau: 'Deconstruction',
		bestand: 'Existing stock',
		analysieren: 'Analyze',
		erklaeren: 'Explain',
		normal: 'Normal',
		rechnen: 'Compute',
		stoerung: 'Disruption'
	};
	const stil = $derived(
		stilFuer({ zoom, modus, situation, thema: theme.mode === 'dark' ? 'dunkel' : 'hell' })
	);
	onMount(() => {
		bereit = true;
	});
	$effect(() => {
		if (!bereit) return;
		try {
			const szene = zeichneSzene(pruefszene, stil, host);
			fehler = '';
			return () => szene.dispose();
		} catch (error) {
			fehler = error instanceof Error ? error.message : String(error);
		}
	});
</script>

<div class="pruefstand">
	<div class="steuerung">
		<ToggleGroup.Root
			type="single"
			value={zoom}
			onValueChange={(v) => {
				if (v) zoom = v as Zoom;
			}}
			aria-label="Zoom"
		>
			{#each ZOOM as v (v)}<ToggleGroup.Item value={v}>{namen[v]}</ToggleGroup.Item>{/each}
		</ToggleGroup.Root>
		<ToggleGroup.Root
			type="single"
			value={modus}
			onValueChange={(v) => {
				if (v) modus = v as Modus;
			}}
			aria-label="Mode"
		>
			{#each MODI as v (v)}<ToggleGroup.Item value={v}>{namen[v]}</ToggleGroup.Item>{/each}
		</ToggleGroup.Root>
		<ToggleGroup.Root
			type="single"
			value={situation}
			onValueChange={(v) => {
				if (v) situation = v as Situation;
			}}
			aria-label="Situation"
		>
			{#each SITUATIONEN as v (v)}<ToggleGroup.Item value={v}>{namen[v]}</ToggleGroup.Item>{/each}
		</ToggleGroup.Root>
	</div>
	<div class="buehne" bind:this={host} bind:clientWidth={breite}></div>
	<div class="lesezeile">
		<p role="status">{namen[zoom]} · {namen[modus]} · {namen[situation]}</p>
		<span class="massstab"
			><svg
				aria-hidden="true"
				width={(5 * stil.kamera.pxProM * breite) / 1000}
				height="12"
				viewBox={`0 0 ${(5 * stil.kamera.pxProM * breite) / 1000} 12`}
				><path
					d={`M 0 2 V 10 M 0 6 H ${(5 * stil.kamera.pxProM * breite) / 1000} M ${(5 * stil.kamera.pxProM * breite) / 1000} 2 V 10`}
				/></svg
			>5 m</span
		>
	</div>
	{#if stil.legende}<p class="legende">
			Analysis · teal: tension · violet: compression · gray: zero-force strut{stil.analyseVeraltet
				? ' · outdated state'
				: ''}
		</p>{/if}
	{#if fehler}<p role="alert">The test scene could not start: {fehler}</p>{/if}
</div>

<style>
	.massstab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.massstab svg {
		stroke: currentColor;
		fill: none;
	}
	.steuerung :global(button:hover) {
		color: var(--ink);
	}
	.pruefstand {
		width: 100%;
		min-width: 0;
	}
	.steuerung {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.steuerung :global([data-toggle-group-root]) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.steuerung :global(button) {
		font: inherit;
		font-size: var(--text-sm);
		color: var(--ink-2);
		background: transparent;
		border: 0;
		padding: 0.5rem 0.65rem;
		cursor: pointer;
		min-height: 44px;
	}
	.steuerung :global(button[data-state='on']) {
		color: var(--ink);
		background: var(--paper-2);
	}
	.steuerung :global(button:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.buehne {
		aspect-ratio: 3 / 2;
		width: 100%;
		overflow: hidden;
	}
	.buehne :global(canvas) {
		display: block;
		max-width: 100%;
	}
	.lesezeile {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--ink-2);
	}
	p {
		margin: 0;
	}
	.legende {
		font-size: var(--text-sm);
		padding-top: var(--space-3);
		color: var(--ink-2);
	}
	@media (max-width: 600px) {
		.lesezeile {
			flex-direction: column;
		}
	}
</style>
