<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { chapters } from './chapters';

	let { onnavigate }: { onnavigate?: (event: MouseEvent) => void } = $props();
</script>

<nav class="chapter-links" aria-label="Chapters">
	{#each chapters as { number, slug, title } (slug)}
		<a
			class="label"
			href={resolve(slug)}
			aria-current={page.route.id === slug ? 'page' : undefined}
			onclick={onnavigate}
		>
			<span>{number}</span>
			{title}
		</a>
	{/each}
</nav>
