<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Popover } from '../lib/ui/popover';
	import { ToggleGroup } from '../lib/ui/toggle-group';
	import ChapterLinks from './ChapterLinks.svelte';

	const themes = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];
	let theme = $state('');
	let chaptersOpen = $state(false);

	onMount(() => {
		const root = document.documentElement;
		const preference = matchMedia('(prefers-color-scheme: dark)');
		theme = root.dataset.theme ?? 'light';

		function followPreference() {
			if (root.dataset.themeChoice) return;
			theme = preference.matches ? 'dark' : 'light';
			root.dataset.theme = theme;
		}

		preference.addEventListener('change', followPreference);
		followPreference();
		return () => preference.removeEventListener('change', followPreference);
	});

	function setTheme(value: string) {
		theme = value;
		const root = document.documentElement;
		root.dataset.theme = value;
		root.dataset.themeChoice = value;
		try {
			localStorage.setItem('cg-theme', value);
		} catch {
			// The active theme still works with storage disabled.
		}
	}

	function closeChapters(event: MouseEvent) {
		if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
			chaptersOpen = false;
	}
</script>

<header class="site-header">
	<div class="page site-bar">
		<a class="label site-brand" href={resolve('/')}>City Design System</a>
		<div class="site-chapters">
			<ChapterLinks />
		</div>
		<div class="site-chapters-menu">
			<Popover label="Chapters" bind:open={chaptersOpen}>
				<ChapterLinks onnavigate={closeChapters} />
			</Popover>
		</div>
		<ToggleGroup label="Theme" items={themes} bind:value={() => theme, setTheme} />
	</div>
</header>
