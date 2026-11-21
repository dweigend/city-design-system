<script lang="ts">
	import VolumeFrame from './VolumeFrame.svelte';
	import { volumeStudy } from '../data/volume-study';
</script>

<section id="volume-section" aria-labelledby="volume-title">
	<div class="section">
		<div class="intro">
			<h2 id="volume-title">{volumeStudy.title}</h2>
			<p>{volumeStudy.description}</p>
		</div>
		<VolumeFrame
			phase={0}
			annotated
			label={volumeStudy.section +
				' Face treatments: ' +
				volumeStudy.faces.map((f) => f.name).join(', ') +
				'.'}
		/>
	</div>
	<div class="phases" id="construction-phases" role="group" aria-label="Construction phases">
		{#each volumeStudy.phases as phase, i (phase.name)}
			<figure>
				<VolumeFrame phase={i} label={phase.name + '. ' + phase.caption} />
				<figcaption>
					<h3>{phase.name}</h3>
					<p>{phase.caption}</p>
				</figcaption>
			</figure>
		{/each}
	</div>
</section>

<style>
	section {
		margin-bottom: var(--space-16);
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
	.phases {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-6);
		margin-top: var(--space-5);
	}
	figure {
		margin: 0;
		border-top: var(--hair) solid var(--line);
	}
	h3 {
		font-size: var(--text-m);
	}
	figcaption p {
		font-size: var(--text-s);
	}
	@media (max-width: 720px) {
		.section,
		.phases {
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
