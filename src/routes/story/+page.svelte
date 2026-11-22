<script module lang="ts">
	export const lead =
		'In an invented valley, the first farms grow into a metropolis under the same rules as the game until you take over in 2030.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/story');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />
