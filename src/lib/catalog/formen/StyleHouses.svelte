<script lang="ts">
	import StyleHouseFrame from './StyleHouseFrame.svelte';
	import { styleHouses } from '../data/style-houses';
</script>

<div class="intro" id="construction-phases">
	<h3>{styleHouses.title}</h3>
	<p>{styleHouses.lead}</p>
</div>
<div class="houses" role="group" aria-label="Construction phase comparison">
	{#each styleHouses.houses as house (house.id)}
		<figure>
			<StyleHouseFrame house={house.id} label={house.name + '. ' + house.caption} />
			<figcaption>
				<h4>{house.name}</h4>
				<p>{house.caption}</p>
			</figcaption>
		</figure>
	{/each}
</div>

<style>
	.intro {
		margin-top: var(--space-8);
		scroll-margin-top: var(--space-4);
	}
	.intro p {
		max-width: 65ch;
	}
	p {
		line-height: 1.4;
		color: var(--ink-2);
	}
	.houses {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-6);
		margin-top: var(--space-5);
	}
	figure {
		margin: 0;
	}
	figcaption {
		margin-top: var(--space-3);
	}
	h3,
	h4 {
		font-size: var(--text-m);
	}
	figcaption p {
		font-size: var(--text-s);
		margin-top: var(--space-1);
	}
	@media (max-width: 720px) {
		.houses {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
