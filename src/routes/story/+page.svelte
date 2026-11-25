<script module lang="ts">
	export const lead = 'Follow one river valley from its first buildings to the 2030 handover.';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentProps } from 'svelte';
	import {
		createStoryValley,
		storyPrecedent,
		storyYears,
		type StoryYear
	} from '../../lib/world/story-valley';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import { createStoryDrawing } from './drawing';

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
	let story = $state.raw<ReturnType<typeof createStoryValley>>();
	let drawing = $state.raw<ReturnType<typeof createStoryDrawing>>();
	let failed = $state(false);
	const snapshot = $derived(story?.snapshots.find((snapshot) => snapshot.year === year));
	const stage: ComponentProps<typeof ChapterViewer>['stage'] = $derived({
		drawables: snapshot && drawing ? drawing.draw(snapshot) : [],
		fit: drawing?.fit,
		display: 'normal',
		view: 'iso',
		landscape: true,
		label: `River valley in ${year} · ${milestones[year]}`
	});
	const example = $derived(
		story?.snapshots.at(-1)?.buildings.find(({ id }) => id === story?.adoption.buildingId)
	);
	const lower = $derived(
		example?.parts.find(({ part }) => part.id === story?.adoption.retainedPartId)
	);
	const upper = $derived(
		example?.parts.find(({ part }) => part.id === story?.adoption.additionPartId)
	);

	onMount(() => {
		try {
			const world = createStoryValley();
			drawing = createStoryDrawing(world);
			story = world;
		} catch {
			failed = true;
		}
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
		{#if failed}
			<p class="small" role="alert">Could not build the valley. Reload the page to try again.</p>
		{/if}
	</section>
	<section class="stack" aria-labelledby="story-precedent">
		<h2 id="story-precedent">{storyPrecedent.project}</h2>
		<p class="small">
			{storyPrecedent.architects} retained the original housing tower, built in 1959–62, and added winter
			gardens and balconies in {storyPrecedent.location} in {storyPrecedent.year}.
			<a
				href="https://www.parishabitat.fr/a-la-une/la-tour-du-bois-le-pretre-en-fete-pour-ses-10-ans/"
				>Paris Habitat</a
			>
			·
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
		{#if year === handoverYear && lower && upper}
			<p class="small">
				Retained lower storey <code translate="no">{lower.part.id}</code> · {lower.builtYear}<br />
				First added storey <code translate="no">{upper.part.id}</code> · {upper.builtYear}
			</p>
		{/if}
	</section>
</div>
