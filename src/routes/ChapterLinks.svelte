<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { chapters } from './chapters';

	let { onnavigate }: { onnavigate?: (event: MouseEvent) => void } = $props();
</script>

<nav class="chapter-links" aria-label="Chapters">
	{#each chapters as { number, slug, title, label } (slug)}
		<a
			class="label"
			href={resolve(slug)}
			aria-label={title}
			aria-current={page.route.id === slug ? 'page' : undefined}
			onclick={onnavigate}
		>
			<span class="chapter-link-number">{number}</span>
			{label}
		</a>
	{/each}
	<a
		class="label"
		href={resolve('/sandbox')}
		aria-current={page.route.id === '/sandbox' ? 'page' : undefined}
		onclick={onnavigate}>Sandbox</a
	>
</nav>
