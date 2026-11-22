<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import Icon from '../ui/Icon.svelte';
	import { CourtPlan, CourtSection } from '../raster';
	import type { CourtStudy } from '../raster/court-study.server';
	import { VolumeFrame } from '../formen';
	import { ConnectionFrame } from '../interface';
	import { connectionViews } from '../logic/connection-study';
	import { required } from '../logic/required';
	import { cityReadingPath } from '../data/city-reading-path';
	import { volumeStudy } from '../data/volume-study';

	let { study }: { study: CourtStudy } = $props();
	type Step = (typeof cityReadingPath)[keyof typeof cityReadingPath];
	const bridge = required(
		connectionViews.find(({ id }) => id === 'bridge-landing'),
		'bridge landing'
	);
</script>

{#snippet step(item: Step, picture: Snippet)}
	<li>
		<div class="copy">
			<span>{item.step} · {item.status}</span>
			<h2>{item.title}</h2>
			<p>{item.text}</p>
		</div>
		<div class="picture">{@render picture()}</div>
		<a href={resolve(item.href)}>{item.link}<Icon icon={ArrowRight} size={16} /></a>
	</li>
{/snippet}

<ol id="city-reading-path" aria-label="From city plan to building connection">
	{@render step(cityReadingPath.plan, plan)}
	{@render step(cityReadingPath.grid, grid)}
	{@render step(cityReadingPath.volume, volume)}
	{@render step(cityReadingPath.connection, connection)}
</ol>

{#snippet plan()}
	<CourtPlan {study} later showCaption={false} />
{/snippet}
{#snippet grid()}
	<CourtSection section={study.section} showCaption={false} />
{/snippet}
{#snippet volume()}
	<VolumeFrame label={volumeStudy.section} />
{/snippet}
{#snippet connection()}
	<ConnectionFrame connection={bridge} showCaption={false} />
{/snippet}

<style>
	ol {
		display: grid;
		max-width: 1040px;
		margin: 0 auto var(--space-12);
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.5fr);
		grid-template-areas: 'copy picture' 'link picture';
		grid-template-rows: 1fr 1fr;
		gap: var(--space-2) var(--space-10);
		align-items: center;
		padding-block: var(--space-5);
		border-block-start: var(--hair) solid var(--line);
	}
	.copy {
		grid-area: copy;
		align-self: end;
	}
	.picture {
		grid-area: picture;
		width: 100%;
		max-width: 480px;
		justify-self: center;
	}
	li:last-child .picture {
		max-width: 400px;
	}
	span {
		color: var(--ink-2);
		font: var(--text-xs) var(--font-mono);
	}
	h2 {
		margin-block: var(--space-1) var(--space-2);
		font-size: var(--text-l);
		line-height: 1.15;
		text-wrap: balance;
	}
	p {
		max-width: 40ch;
		color: var(--ink-2);
		font-size: var(--text-s);
		line-height: 1.5;
	}
	a {
		grid-area: link;
		align-self: start;
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		color: var(--ink);
		font-size: var(--text-s);
		text-underline-offset: 0.2em;
	}
	a:hover {
		text-decoration-thickness: var(--stroke);
	}
	@media (max-width: 720px) {
		li {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'copy' 'picture' 'link';
			grid-template-rows: auto auto auto;
			align-content: start;
			gap: var(--space-4);
			padding-block: var(--space-6);
		}
	}
</style>
