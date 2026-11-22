<script lang="ts">
	import { landscapeChapter } from '../data/chapters';
	import { createValleyChapterStage } from '../scene/valley';
	import ChapterFrame from './ChapterFrame.svelte';
</script>

<ChapterFrame chapter={landscapeChapter} createStage={createValleyChapterStage} />
