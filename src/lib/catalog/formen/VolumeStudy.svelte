<script lang="ts">
	import { resolve } from '$app/paths';
	import HouseCourtFrame from './HouseCourtFrame.svelte';
	import StyleHouses from './StyleHouses.svelte';
	import { volumeStudy } from '../data/volume-study';
</script>

<section id="volume-section" aria-labelledby="volume-title">
	<div class="section">
		<div class="intro">
			<h2 id="volume-title">{volumeStudy.title}</h2>
			<p>{volumeStudy.description}</p>
			<p>
				See <a href={resolve('/formen#FORM-1')}>FORM-1</a> for the occupied and open cells.
			</p>
		</div>
		<HouseCourtFrame />
	</div>
	<StyleHouses />
	<p class="next">
		<a href={resolve('/interface#connections')}>Next: Trace building connections</a>
	</p>
</section>

<style>
	section {
		margin-bottom: var(--space-16);
		scroll-margin-top: var(--space-4);
	}
	.section {
		display: grid;
		grid-template-columns: minmax(12rem, 0.9fr) minmax(0, 2fr);
		align-items: center;
		gap: var(--space-6);
	}
	h2 {
		font-size: var(--text-xl);
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.intro p {
		max-width: 29ch;
		margin-top: var(--space-4);
	}
	p {
		line-height: 1.4;
		color: var(--ink-2);
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.2em;
	}
	.next {
		margin-top: var(--space-5);
		font-size: var(--text-s);
	}
	@media (max-width: 720px) {
		.section {
			grid-template-columns: minmax(0, 1fr);
		}
		.intro p {
			max-width: 46ch;
			margin-top: var(--space-2);
		}
		.section {
			gap: var(--space-3);
		}
	}
</style>
