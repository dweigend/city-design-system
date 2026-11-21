<script lang="ts">
	import { resolve } from '$app/paths';
	import CourtPlan from './CourtPlan.svelte';
	import CourtSection from './CourtSection.svelte';
	import type { CourtStudy } from './court-study.server';

	let { study }: { study: CourtStudy } = $props();
</script>

<section id="court-growth" aria-labelledby="court-title">
	<header>
		<h2 id="court-title">Growth at the square</h2>
		<span>Seed 7</span>
	</header>
	<div class="plans"><CourtPlan {study} /><CourtPlan {study} later /></div>
	<div class="section" id="spatial-grid">
		<CourtSection section={study.section} />
		<div class="notes">
			<p>
				<strong>In the game</strong> Contours mark half-metre changes in terrain height. Grey lots
				stay in place. One new lot joins the group in {study.afterYear}.
			</p>
			<p>
				<strong>Planned</strong> The outer line marks the proposed volume. The subgrid divides it by
				lot and storey. The square stays open. See the
				<a href={resolve('/raster#GRID-2')}>grid limits and exceptions</a>, then follow the
				<a href={resolve('/formen#volume-section')}>occupied and open volumes</a>.
			</p>
		</div>
	</div>
</section>

<style>
	section {
		max-width: 1040px;
		margin: 0 auto var(--space-12);
	}
	header,
	.plans,
	.section {
		display: grid;
		gap: var(--space-6);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: var(--space-2) 0 var(--space-6);
	}
	h2 {
		font-size: clamp(var(--text-l), 3vw, var(--text-xl));
		letter-spacing: -0.035em;
		line-height: 1.1;
	}
	header span,
	strong {
		font: var(--text-xs) var(--font-mono);
	}
	.plans,
	.section {
		grid-template-columns: 1fr 1fr;
	}
	.section {
		margin-top: var(--space-4);
		align-items: center;
	}
	.notes {
		display: grid;
		gap: var(--space-3);
		max-width: 48ch;
	}
	p {
		font-size: var(--text-s);
		line-height: 1.5;
	}
	strong {
		display: block;
		margin-bottom: var(--space-1);
		color: var(--ink-2);
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.2em;
	}
	@media (max-width: 680px) {
		.plans,
		.section {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}
		header {
			margin-bottom: var(--space-4);
		}
	}
</style>
