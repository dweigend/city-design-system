<script module lang="ts">
	export const lead =
		'The city draws on a chosen palette, with colors in the transparent view marking what infrastructure does and existing buildings shown as pale forms or pencil outlines.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/surfaces');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />
