<script lang="ts">
	import { onMount } from 'svelte';
	import type { EnvelopePlateMesh } from '../logic/envelope-plate';
	import { renderEnvelopePlate } from '../scene/building-envelope';
	import ChoiceControl from './ChoiceControl.svelte';
	let { meshes }: { meshes: EnvelopePlateMesh[] } = $props();
	let view = $state('axonometric'),
		host: HTMLElement,
		canvas: HTMLCanvasElement;
	let error = $state(''),
		plate = $state<ReturnType<typeof renderEnvelopePlate>>();
	const grids = ['Square', 'Corner grid', 'Organic'];
	const rows = [
		['Hip', 'Directional hips'],
		['Gable', 'Single ridge'],
		['Sawtooth', 'Three northlights'],
		['Shed', 'Rounded cantilever']
	];
	onMount(() => {
		try {
			plate = renderEnvelopePlate(
				canvas,
				meshes,
				Array.from(host.querySelectorAll<HTMLCanvasElement>('td canvas'))
			);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unable to draw the plate';
		}
		return () => plate?.dispose();
	});
	$effect(() => plate?.view(view === 'plan'));
</script>

<svelte:head><title>Roof geometry · City Design System</title></svelte:head>
<main bind:this={host}>
	<header>
		<div>
			<h1>Roof geometry</h1>
			<p>One building rule per row, fitted to three cell shapes at a common 12 m span.</p>
		</div>
		<ChoiceControl
			id="envelope-view"
			label="Projection"
			items={[
				{ value: 'axonometric', label: 'Axonometric' },
				{ value: 'plan', label: 'Plan' }
			]}
			bind:value={view}
		/>
	</header>
	{#if error}<p role="alert">{error}</p>{/if}
	<canvas hidden bind:this={canvas}></canvas>
	<table>
		<thead
			><tr
				><th scope="col">Roof</th>{#each grids as grid (grid)}<th scope="col">{grid}</th>{/each}</tr
			></thead
		>
		<tbody
			>{#each rows as row (row[0])}<tr
					><th scope="row">{row[0]}<small>{row[1]}</small></th>{#each grids as grid (grid)}<td
							><canvas
								width="480"
								height="256"
								aria-label={row[0] + ' roof on a ' + grid.toLowerCase() + ' cell'}
							></canvas></td
						>{/each}</tr
				>{/each}</tbody
		>
	</table>
</main>

<style>
	main {
		max-width: 1200px;
		margin: auto;
		padding: var(--space-10) var(--space-8);
		color: var(--ink);
		font-family: var(--font-sans);
	}
	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--space-6);
		margin-bottom: var(--space-8);
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.25rem);
		letter-spacing: -0.05em;
		font-weight: 550;
	}
	p {
		color: var(--ink-2);
		font-size: var(--text-s);
		margin: var(--space-2) 0 0;
	}
	table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
	}
	th,
	td {
		border-top: var(--hair) solid var(--line);
		padding: 0;
	}
	thead th {
		font: normal var(--text-xs) var(--font-mono);
		color: var(--ink-2);
		padding: var(--space-3) 0;
	}
	th:first-child {
		text-align: left;
		width: 16%;
	}
	tbody th {
		font-weight: 550;
		font-size: var(--text-m);
	}
	small {
		display: block;
		font: normal var(--text-xs) var(--font-mono);
		color: var(--ink-2);
		margin-top: var(--space-1);
	}
	td canvas {
		width: 100%;
		height: auto;
		display: block;
	}
	@media (max-width: 600px) {
		main {
			padding: var(--space-5) var(--space-3);
		}
		header {
			align-items: start;
			flex-direction: column;
		}
		tbody th {
			font-size: var(--text-xs);
		}
		small {
			display: none;
		}
		td canvas {
			min-height: 68px;
			object-fit: contain;
		}
		th:first-child {
			width: 18%;
		}
	}
</style>
