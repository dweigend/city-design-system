<script module lang="ts">
	export const lead =
		'This chapter explains why the city looks the way it does through stories on sustainability, architecture and imagined futures, with sources for its claims and images from the game engine.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/content');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />
