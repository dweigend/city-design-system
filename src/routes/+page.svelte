<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import { chapters } from './chapters';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>City Design System</title>
</svelte:head>

<div class="stack">
	<h1>City Design System</h1>
	<p class="lead">
		This design bible shows how a city-building game takes shape, from its river valley to its
		buildings and controls.
	</p>

	<ol class="contents stack" role="list">
		{#each chapters as { number, slug, title } (slug)}
			<li>
				<a href={resolve(slug)}>
					<span class="data">{number}</span>
					<span>{title}</span>
				</a>
				<p class="small">{data.leads[slug]}</p>
			</li>
		{/each}
	</ol>
</div>
