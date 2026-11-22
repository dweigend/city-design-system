<script lang="ts">
	import '../app.css';
	import SiteHeader from './SiteHeader.svelte';

	let { children } = $props();
</script>

<a class="skip-link" href="#main-content">Skip to content</a>
<SiteHeader />
<main class="page" id="main-content" tabindex="-1">
	{@render children()}
</main>
