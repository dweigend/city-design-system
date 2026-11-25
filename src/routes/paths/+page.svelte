<script module lang="ts">
	export const lead =
		'Footpaths connect both banks at ground level and above the roofs. Stations join the same walking network.';
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import ValleyDemo from './valley/ValleyDemo.svelte';

	const chapter = chapterAt('/paths');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<p><a href={resolve('/paths/valley')}>City and valley demo</a></p>

<ValleyDemo />
