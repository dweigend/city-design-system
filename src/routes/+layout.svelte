<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { observeKeyboard } from '../lib/catalog/ui/keyboard.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:window onkeydown={observeKeyboard} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
