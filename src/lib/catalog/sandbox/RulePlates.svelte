<script lang="ts">
	import PrimitiveView from '../scene/PrimitiveView.svelte';
	import type { RulePlate } from '../logic/bibel/hausregel';

	/** Plates of the house rule side by side, drawn by the bible's own primitive view. */
	let {
		title,
		text,
		plates,
		controls,
		fitView = false
	}: {
		title: string;
		text: string;
		plates: RulePlate[];
		controls?: import('svelte').Snippet;
		fitView?: boolean;
	} = $props();
</script>

<svelte:head><title>{title} · City Design System</title></svelte:head>
<main>
	<h1>{title}</h1>
	<p>{text}</p>
	{@render controls?.()}
	<div class="plates">
		{#each plates as plate (plate.id)}
			<figure
				class:block-study={fitView || plate.id === 'block-grid' || plate.id === 'roof-blocks'}
			>
				<div class="view">
					<PrimitiveView
						primitives={plate.primitives}
						label="{plate.title}: {plate.text}"
						tools={false}
						rulePlate
					/>
				</div>
				<figcaption><strong>{plate.title}.</strong> {plate.text}</figcaption>
			</figure>
		{/each}
	</div>
</main>

<style>
	main {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-12);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-l);
	}
	p {
		max-width: 60ch;
		margin: 0 0 var(--space-6);
		color: var(--ink-2);
	}
	.plates {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr));
		gap: var(--space-4);
	}
	figure {
		margin: 0;
	}
	.view {
		height: 560px;
		border: var(--hair) solid var(--line);
	}
	.block-study .view {
		height: auto;
	}
	figcaption {
		margin-top: var(--space-2);
		color: var(--ink-2);
		font-size: var(--text-s);
	}
</style>
