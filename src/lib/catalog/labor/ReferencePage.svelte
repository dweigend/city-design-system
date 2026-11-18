<script lang="ts">
	import { Button } from 'bits-ui';
	import DesignShell from '../design/DesignShell.svelte';
	import ArtStudy from './ArtStudy.svelte';
	let seed = $state(17);
	const studies = [
		{
			kind: 'collage',
			name: 'Collage stock',
			position: '23 716 / 3 269',
			rule: 'Pack the stock in pencil. Lift a second volume above the largest fragment.',
			measure: '256 candidates per fragment'
		},
		{
			kind: 'vessel',
			name: 'Ceramic inlet',
			position: '21 692 / 3 256',
			rule: 'Shift the neck through successive shoulders. Carry one opening through the body.',
			measure: '65 hollow cross-sections'
		}
	] as const;
</script>

<svelte:head><title>Reference studies · City Design System</title></svelte:head>
<DesignShell title="Reference studies">
	<div class="controls">
		<span aria-live="polite">Seed {seed}</span><Button.Root
			onclick={() => (seed = (seed + 1) >>> 0)}>Next seed</Button.Root
		>
	</div>
	{#each studies as study (study.kind)}
		<section>
			<div>
				<h2>{study.name}</h2>
				<p class="position">Board {study.position}</p>
				<p>{study.rule}</p>
				<small>{study.measure}</small>
			</div>
			<ArtStudy kind={study.kind} {seed} />
		</section>
	{/each}
</DesignShell>

<style>
	.controls,
	section {
		border-top: var(--hair) solid var(--line);
	}
	.controls {
		display: flex;
		gap: var(--space-4);
		align-items: center;
		justify-content: flex-end;
		padding-block: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-s);
	}
	.controls :global(button) {
		background: var(--paper-2);
		color: var(--ink);
		border: var(--hair) solid var(--line);
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
	}
	section {
		display: grid;
		grid-template-columns: minmax(170px, 1fr) 2fr;
		align-items: center;
		gap: var(--space-8);
	}
	h2 {
		font-size: var(--text-l);
	}
	p {
		max-width: 34ch;
		margin-block: var(--space-3);
	}
	.position,
	small {
		font-family: var(--font-mono);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	@media (max-width: 600px) {
		section {
			grid-template-columns: 1fr;
			gap: 0;
			padding-top: var(--space-5);
		}
	}
</style>
