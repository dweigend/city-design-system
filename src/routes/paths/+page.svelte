<script module lang="ts">
	export const lead =
		'The city has footpaths and elevated rail in place of streets, and the game uses that network to work out every route.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/paths');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />
