<script module lang="ts">
	export const lead =
		'Seventeen methods build on the same site by filling or leaving cells open, shaping houses that hold together and fit the terrain.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/architecture');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />
