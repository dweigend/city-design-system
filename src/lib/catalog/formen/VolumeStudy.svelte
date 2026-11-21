<script lang="ts">
	import { resolve } from '$app/paths';
	import VolumeFrame from './VolumeFrame.svelte';
	import { volumeStudy } from '../data/volume-study';
</script>

<section id="volume-section" aria-labelledby="volume-title">
	<div class="section">
		<div class="intro">
			<h2 id="volume-title">{volumeStudy.title}</h2>
			<p>{volumeStudy.description}</p>
			<p>
				See <a href={resolve('/formen#FORM-1')}>FORM-1</a> for the occupied and open cells and
				<a href={resolve('/formen#FORM-3')}>FORM-3</a> for the role of references in
				<a href={resolve('/material#material-familien')}>surface studies</a>.
			</p>
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
	<div class="phase-intro" id="construction-phases">
		<h3>Construction phases</h3>
		<p>
			Lab study · The three phases compare how a new addition becomes visible stock. Game
			integration is planned under <a href={resolve('/formen#FORM-10')}>FORM-10</a>.
		</p>
	</div>
	<div class="phases" role="group" aria-label="Construction phase comparison">
		{#each volumeStudy.phases as phase, i (phase.name)}
			<figure>
				<VolumeFrame phase={i} label={phase.name + '. ' + phase.caption} />
				<figcaption>
					<h4>{phase.name}</h4>
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
	.phase-intro {
		margin-top: var(--space-8);
	}
	.phase-intro p {
		max-width: 65ch;
	}
	h3,
	h4 {
		font-size: var(--text-m);
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.2em;
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
