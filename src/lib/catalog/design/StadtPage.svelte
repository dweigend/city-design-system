<script lang="ts">
	import { resolve } from '$app/paths';
	import DesignShell from './DesignShell.svelte';
	import CityReadingPath from './CityReadingPath.svelte';
	import type { CourtStudy } from '../raster/court-study.server';
	import { cityReview } from '../data/city-reading-path';
	import Wegweiser from './Wegweiser.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
	import { Bauteilpass, Hochwege, Leitbild, Schwammstadt, Weiterbauen } from '../stadt';
	import { leitbild } from '../data/vision';
	import * as T from '../data/stadt';

	let { study }: { study: CourtStudy } = $props();

	/**
	 * Home page: the city. One sentence of guiding vision, the guiding ideas as jump links, then four
	 * experiments in reading order: building on existing stock, elevated walkways, sponge city, component passport.
	 * At the end the way into the other chapters.
	 */
</script>

<svelte:head><title>City · City Design System</title></svelte:head>

<DesignShell title="City">
	<CityReadingPath {study} />
	<DesignPrinciples page="city" />
	<Leitbild {...leitbild} />

	<Abschnitt id={T.weiterbauen.id} titel={T.weiterbauen.titel} lead={T.weiterbauen.lead}>
		<Weiterbauen />
	</Abschnitt>

	<Abschnitt id={T.hochwege.id} titel={T.hochwege.titel} lead={T.hochwege.lead}>
		<Hochwege />
		<p>
			Ordinary growth retains existing buildings (<a href={resolve('/wachstum#GROW-2')}>GROW-2</a>),
			while deliberate path placement may open a passage or remove a small house (<a
				href={resolve('/#CITY-4')}>CITY-4</a
			>).
			<a href={resolve('/interface#connections')}>Trace the bridge landing and other connections</a
			>.
		</p>
	</Abschnitt>

	<Abschnitt id={T.schwamm.id} titel={T.schwamm.titel} lead={T.schwamm.lead}>
		<Schwammstadt />
	</Abschnitt>

	<Abschnitt id={T.bauteile.id} titel={T.bauteile.titel} lead={T.bauteile.lead}>
		<Bauteilpass />
	</Abschnitt>

	<Abschnitt id="open-design" titel="Open design decisions and picture gaps">
		<div class="open-design">
			<div>
				<h3>Decisions</h3>
				<ul>
					{#each cityReview.decisions as decision (decision)}
						<li>{decision}</li>
					{/each}
				</ul>
			</div>
			<div>
				<h3>Picture gaps</h3>
				<ul>
					{#each cityReview.gaps as gap (gap.label)}
						<li><a href={resolve(gap.href)}>{gap.label}</a>. {gap.text}</li>
					{/each}
				</ul>
			</div>
		</div>
	</Abschnitt>

	<Wegweiser />
</DesignShell>

<style>
	.open-design {
		display: grid;
		gap: var(--space-6);
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
	}
	.open-design h3 {
		font-weight: 600;
	}
	.open-design ul {
		display: grid;
		gap: var(--space-2);
		margin-block: var(--space-2) 0;
		padding-inline-start: var(--space-5);
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.2em;
	}
	@media (max-width: 720px) {
		.open-design {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
