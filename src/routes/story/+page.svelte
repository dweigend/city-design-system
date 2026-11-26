<script module lang="ts">
	export const lead = 'Follow one river valley from its first buildings to the 2030 handover.';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentProps } from 'svelte';
	import { storyYears, type StoryYear } from '../../lib/world/story-valley';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import { loadStoryScene, type StoryScene } from './drawing';
	import { storyPrecedent } from './precedent';

	const chapter = chapterAt('/story');
	const milestones: Record<StoryYear, string> = {
		1955: 'First settlement',
		1985: 'Crossing and expansion',
		2012: 'Riverside infill',
		2030: 'Handover'
	};
	const dates = storyYears.map((year) => ({ value: String(year), label: String(year) }));
	const handoverYear = storyYears[storyYears.length - 1];
	let year = $state<StoryYear>(storyYears[0]);
	let scene = $state.raw<StoryScene>();
	let failed = $state(false);
	const hall = $derived(scene?.adoption);
	const stage: ComponentProps<typeof ChapterViewer>['stage'] = $derived({
		drawables: scene ? scene.frames[year] : [],
		fit: scene?.fit,
		display: 'normal',
		view: 'iso',
		landscape: true,
		label: `River valley in ${year} · ${milestones[year]}`
	});

	onMount(() => {
		let active = true;
		loadStoryScene()
			.then((loaded) => {
				if (active) scene = loaded;
			})
			.catch(() => {
				if (active) failed = true;
			});
		return () => {
			active = false;
		};
	});

	function selectDate(value: string) {
		const selected = storyYears.find((candidate) => String(candidate) === value);
		if (selected !== undefined) year = selected;
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<div class="stack">
	<section class="story-hero" aria-label="Valley through time">
		{#if scene}
			<ChapterViewer {stage}>
				{#snippet controls()}
					<p class="chapter-viewer-subject story-date" role="status">
						<strong><time datetime={String(year)}>{year}</time></strong>
						{milestones[year]}
					</p>
					<ToggleGroup
						label="Valley year"
						items={dates}
						bind:value={() => String(year), selectDate}
					/>
				{/snippet}
			</ChapterViewer>
		{:else if failed}
			<p class="small" role="alert">Could not build the valley. Reload the page to try again.</p>
		{:else}
			<p class="small" role="status">Building valley…</p>
		{/if}
	</section>
	<section class="stack" aria-labelledby="story-precedent">
		<h2 id="story-precedent">{storyPrecedent.project}</h2>
		<p class="small">
			{storyPrecedent.architects} retained the original housing tower, built in 1959–62, and added winter
			gardens and balconies in {storyPrecedent.location} in {storyPrecedent.year}.
			<a rel="external" href={storyPrecedent.historyUrl}>Paris Habitat</a> ·
			<a rel="external" href={storyPrecedent.projectUrl}>Project record</a> ·
			<a rel="external" href={storyPrecedent.prizeUrl}
				>{storyPrecedent.prizeYear} Pritzker Architecture Prize</a
			>
		</p>
		<p class="small">
			<q cite={storyPrecedent.principleUrl}>{storyPrecedent.principle}</q>
			<a rel="external" href={storyPrecedent.principleUrl}>Cooper Union lecture</a>
		</p>
		<p class="small">
			The valley keeps the riverside hall and builds above it. In {handoverYear}, its colored upper
			storeys sit on the pale original hall beside the footbridge.
		</p>
		{#if year === handoverYear && hall}
			{@const { retainedPartId: rId, retainedBuiltYear: rYear } = hall}
			{@const { additionPartId: aId, additionBuiltYear: aYear } = hall}
			<p class="small">
				Retained lower storey <code translate="no">{rId}</code> · {rYear}<br />
				First added storey <code translate="no">{aId}</code> · {aYear}
			</p>
		{/if}
	</section>
</div>
