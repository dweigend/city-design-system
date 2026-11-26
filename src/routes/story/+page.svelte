<script module lang="ts">
	export const lead = 'Follow one river valley from its first buildings to the 2030 handover.';
</script>

<script lang="ts">
	import { onMount, type ComponentProps } from 'svelte';
	import type { ViewFit } from '../../lib/scene/stage';
	import type { Drawable } from '../../lib/scene/surface';
	import { Button } from '../../lib/ui/button';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import {
		defaultSeed,
		foundingYear,
		handoverYear,
		milestones,
		nextStorySeed,
		presets,
		type StorySetup,
		type readStoryHandover
	} from './growth';
	import {
		createStoryTimeline,
		showStoryFrame,
		type Dissection,
		type StoryFrame,
		type StoryReply,
		type StoryRequest
	} from './timeline';
	import { storyPrecedent } from './precedent';

	const chapter = chapterAt('/story');
	const presetItems = Object.entries(presets).map(([value, { label }]) => ({ value, label }));
	const planItems = [
		{ value: 'organic', label: 'Organic' },
		{ value: 'square', label: 'Square' },
		{ value: 'hex', label: 'Hex' }
	];
	const dissectionItems = [
		{ value: 'assembled', label: 'Assembled' },
		{ value: 'explode', label: 'Explode' },
		{ value: 'section', label: 'Section' },
		{ value: 'transparency', label: 'Transparency' }
	];
	const eventDelayMs = 180;
	const empty: readonly Drawable[] = [];

	let setup = $state.raw<StorySetup>({
		seed: defaultSeed,
		preset: 'handover',
		planFamily: 'organic'
	});
	let timeline = createStoryTimeline(0);
	let requestId = 0;
	let worker: Worker | undefined;
	let autoHandover = true;
	let stageUnavailable = false;
	let firstDrawn = false;
	let shown = $state.raw<StoryFrame>();
	let fit = $state.raw<ViewFit>();
	let limit = $state(0);
	let readyYears = $state.raw<readonly number[]>([]);
	let handover = $state.raw<ReturnType<typeof readStoryHandover>>();
	let complete = $state(false);
	let failed = $state(false);
	let playing = $state(false);
	let dissection = $state<Dissection>('assembled');

	const adoption = $derived(handover?.adoption);
	const year = $derived(shown?.year ?? foundingYear);
	const count = $derived(shown?.eventCount ?? 0);
	const settledMilestone = $derived(
		shown && readyYears.length
			? milestones.find(({ year: target }) => timeline.checkpoints.get(target) === shown)
			: undefined
	);
	const milestone = $derived(settledMilestone?.label);
	const handoverSettled = $derived(
		Boolean(handover && shown && timeline.checkpoints.get(handoverYear) === shown)
	);
	const dates = $derived(
		milestones.map(({ year }) => ({
			value: String(year),
			label: String(year),
			disabled: !readyYears.includes(year)
		}))
	);
	const drawables = $derived(shown ? showStoryFrame(shown, timeline.parts, dissection) : empty);
	const stage: ComponentProps<typeof ChapterViewer>['stage'] = $derived({
		drawables,
		fit:
			dissection === 'transparency'
				? (shown?.serviceFit ?? fit)
				: dissection === 'assembled'
					? fit
					: (shown?.detailFit ?? fit),
		display: dissection === 'transparency' ? 'transparency' : 'normal',
		view: 'iso',
		landscape: true,
		interactive: true,
		onRender,
		onUnavailable: markUnavailable,
		label: `River valley in ${year}${milestone ? ' · ' + milestone : ''}`
	});

	function closeWorker() {
		worker?.terminate();
		worker = undefined;
	}

	function selectHandover() {
		const final = timeline.checkpoints.get(handoverYear);
		if (autoHandover && firstDrawn && final) {
			autoHandover = false;
			shown = final;
		}
	}

	function onRender(rendered: readonly Drawable[]) {
		if (firstDrawn || rendered === empty || rendered !== drawables) return;
		allowHandover();
	}

	function markUnavailable() {
		stageUnavailable = true;
		allowHandover();
	}

	function allowHandover() {
		firstDrawn = true;
		selectHandover();
	}

	function frameAt(targetCount: number) {
		if (complete && targetCount === limit) {
			const final = timeline.checkpoints.get(handoverYear);
			if (final) return final;
		}
		for (const checkpoint of timeline.checkpoints.values()) {
			if (checkpoint.eventCount === targetCount) return checkpoint;
		}
		return timeline.events[targetCount - 1];
	}

	function start(next: StorySetup, autoSelect = false) {
		closeWorker();
		setup = next;
		autoHandover = autoSelect;
		firstDrawn = stageUnavailable;
		playing = false;
		failed = false;
		complete = false;
		limit = 0;
		handover = undefined;
		readyYears = [];
		shown = undefined;
		timeline = createStoryTimeline(++requestId);
		let active: Worker;
		try {
			active = new Worker(new URL('./valley.worker.ts', import.meta.url), { type: 'module' });
		} catch {
			failed = true;
			return;
		}
		worker = active;
		const request: StoryRequest = { requestId, setup: next };

		function fail() {
			if (worker !== active) return;
			failed = true;
			playing = false;
			closeWorker();
		}

		active.onmessage = ({ data }: MessageEvent<StoryReply>) => {
			if (worker !== active || !timeline.accepts(data)) return;
			if (data.kind === 'error') return fail();
			timeline.append(data);
			limit = timeline.events.length;
			if (data.fit) fit = data.fit;
			if (data.checkpoint) {
				readyYears = [...timeline.checkpoints.keys()];
				shown ??= data.checkpoint;
				selectHandover();
			}
			if (data.handover) {
				handover = data.handover;
				complete = true;
				closeWorker();
			}
		};
		active.onerror = fail;
		active.onmessageerror = fail;
		active.postMessage(request);
	}

	onMount(() => {
		start(setup, true);
		return closeWorker;
	});

	function seek(frame?: StoryFrame) {
		if (!frame) return;
		autoHandover = false;
		playing = false;
		shown = frame;
	}

	function togglePlayback() {
		autoHandover = false;
		if (!playing && complete && count === limit) {
			shown = timeline.checkpoints.get(foundingYear) ?? timeline.events[0];
		}
		playing = !playing;
	}

	$effect(() => {
		if (!playing) return;
		if (count >= limit) {
			if (complete) playing = false;
			return;
		}
		const tick = setTimeout(() => {
			shown = frameAt(count + 1);
		}, eventDelayMs);
		return () => clearTimeout(tick);
	});
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<div class="stack">
	<section class="story-hero" aria-label="Valley through time">
		<ChapterViewer {stage}>
			{#snippet controls()}
				<div class="story-overview">
					<p class="story-date" role="status">
						{#if shown}
							<strong><time datetime={String(year)}>{year}</time></strong>
							{milestone ?? ''}
						{:else if failed}
							Select New City to retry.
						{:else}
							Surveying the valley…
						{/if}
					</p>
					<span class="small story-seed">Seed {setup.seed}</span>
					<ToggleGroup
						label="Valley year"
						items={dates}
						bind:value={
							() => (milestone ? String(year) : ''),
							(value) => seek(timeline.checkpoints.get(Number(value)))
						}
					/>
				</div>
				<div class="story-controls">
					<Select
						label="Scale"
						items={presetItems}
						bind:value={
							() => setup.preset,
							(value) => {
								if (value !== setup.preset)
									start({ ...setup, preset: value as StorySetup['preset'] }, true);
							}
						}
						portalTo=".chapter-viewer"
					/>
					<Select
						label="Plan family"
						items={planItems}
						bind:value={
							() => setup.planFamily,
							(value) => {
								if (value !== setup.planFamily)
									start({ ...setup, planFamily: value as StorySetup['planFamily'] }, true);
							}
						}
						portalTo=".chapter-viewer"
					/>
					<Select
						label="Dissection"
						items={dissectionItems}
						bind:value={() => dissection, (value) => (dissection = value as Dissection)}
						portalTo=".chapter-viewer"
					/>
					<Button
						label="New City"
						onclick={() => start({ ...setup, seed: nextStorySeed(setup.seed) })}
					/>
				</div>
				<div class="story-playback">
					<div class="story-transport">
						<Button
							label={playing ? 'Pause' : 'Play'}
							disabled={!shown || failed}
							onclick={togglePlayback}
						/>
						<Button
							label="Back"
							ariaLabel="Step backward"
							disabled={count <= 1}
							onclick={() => seek(frameAt(count - 1))}
						/>
						<Button
							label="Next"
							ariaLabel="Step forward"
							disabled={count >= limit}
							onclick={() => seek(frameAt(count + 1))}
						/>
					</div>
					{#if limit > 1}
						<Slider
							label="Scrub events"
							min={1}
							max={limit}
							step={1}
							bind:value={() => count, (value: number) => seek(frameAt(value))}
						/>
					{/if}
				</div>
				{#if dissection === 'transparency' && shown?.serviceFit}
					<p class="small story-stock">Water service visible</p>
				{:else if failed && shown}
					<p class="small story-stock" role="alert">
						The timeline could not finish. Select New City to try again.
					</p>
				{/if}
			{/snippet}
		</ChapterViewer>
		{#if handoverSettled && handover}
			<p class="small story-stock">
				Sandbox handover · {handover.buildings} buildings · {handover.publicAssets} public assets · {handover.placements}
				editable placements
			</p>
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
		{#if adoption}
			<p class="small">
				The founding building gains an upper storey in 2030. The pale lower storey stays in place as
				the colored addition rises above it.
			</p>
			<dl class="story-adoption small">
				<div>
					<dt>Retained lower storey</dt>
					<dd><code translate="no">{adoption.retained.id}</code> · {adoption.retained.year}</dd>
				</div>
				<div>
					<dt>First added storey</dt>
					<dd><code translate="no">{adoption.added.id}</code> · {adoption.added.year}</dd>
				</div>
			</dl>
		{/if}
	</section>
</div>
