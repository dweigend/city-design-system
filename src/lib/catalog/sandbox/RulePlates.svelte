<script lang="ts">
	import PrimitiveView from '../scene/PrimitiveView.svelte';
	import { rulePlates } from '../logic/bibel/hausregel';

	/** One house rule on three grids, side by side, drawn by the bible's own primitive view. */
	const plates = rulePlates();
</script>

<svelte:head><title>One house rule, any grid · City Design System</title></svelte:head>
<main>
	<h1>One house rule, any grid</h1>
	<p>
		The same building program on three carriers. The rule reads only cells, sides and neighbors;
		walls, windows, roof edges and crowns take their measure from each cell.
	</p>
	<div class="plates">
		{#each plates as plate (plate.id)}
			<figure>
				<div class="view">
					<PrimitiveView
						primitives={plate.primitives}
						label="{plate.title}: {plate.text}"
						tools={false}
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
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: var(--space-4);
	}
	figure {
		margin: 0;
	}
	.view {
		height: 440px;
		border: var(--hair) solid var(--line);
	}
	figcaption {
		margin-top: var(--space-2);
		color: var(--ink-2);
		font-size: var(--text-s);
	}
</style>
