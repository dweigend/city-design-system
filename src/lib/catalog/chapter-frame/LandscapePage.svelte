<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { landscapeChapter, type ChapterStep } from '../data/chapters';
	import { createValleyChapterStage } from '../scene/valley';
	import ChapterFrame from './ChapterFrame.svelte';

	function navigateToStep(id: ChapterStep['id']) {
		const search = location.search ? (`?${location.search.slice(1)}` as const) : '';
		void goto(resolve(`/landschaft${search}#${id}`), { shallow: true, state: page.state });
	}
</script>

<ChapterFrame chapter={landscapeChapter} createStage={createValleyChapterStage} {navigateToStep} />
