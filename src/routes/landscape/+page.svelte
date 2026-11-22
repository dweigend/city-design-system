<script module lang="ts">
	export const lead =
		'The book begins in an invented valley, where a river shapes the ground for everything that follows and one typeface labels it.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/landscape');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<div class="stack">
	<p>
		The river cuts its course through the valley, leaving a floodplain below and terraces along the
		slopes.
	</p>
	<p>The first settlement, its paths and the city that follows all stand on that ground.</p>
	<p>
		The same typeface names the river, marks elevations on the map and labels the controls in the
		game.
	</p>
</div>
