import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ResolvedPathname } from '$app/types';
import { SvelteURLSearchParams } from 'svelte/reactivity';
import type { Chapter, ChapterStep } from '../data/chapters';
import { resolveView, type ResolvedView } from '../logic/view-modes';
import type { ChapterStage } from '../scene/chapter-stage';

const moveMs = 480;

/** Owns the URL selection, seed overrides and playback for one mounted chapter. */
export function createChapterController(chapter: () => Chapter) {
	let step = $state.raw<ChapterStep>();
	let selection = $state.raw<ResolvedView>();
	let seedOverride = $state<number>();
	const seed = $derived(seedOverride ?? step?.preset.seed);
	let playing = $state(false);
	let error = $state(false);
	let stage: ChapterStage | undefined;
	let timers: ReturnType<typeof setTimeout>[] = [];

	function cancelPlayback() {
		for (const timer of timers) clearTimeout(timer);
		timers = [];
		playing = false;
	}

	function writeLocation(id: ChapterStep['id'], view?: string, replace = false) {
		const params = new SvelteURLSearchParams(location.search);
		if (view) params.set('view', view);
		else params.delete('view');
		const search = params.size ? `?${params}` : '';
		// The current route pathname already includes the configured base.
		const url = `${page.url.pathname}${search}#${id}` as ResolvedPathname;
		void goto(url, { shallow: true, replace, state: page.state });
	}

	function showStep(next: ChapterStep, view: ResolvedView, durationMs: number) {
		const sameScene = step?.preset.scene === next.preset.scene;
		cancelPlayback();
		step = next;
		seedOverride = undefined;
		selection = view;
		if (!sameScene) {
			error = false;
			return;
		}
		stage?.show(next.preset);
		stage?.reveal();
		stage?.setView(view, durationMs);
	}

	function syncLocation() {
		const { steps } = chapter();
		const next = steps.find((item) => '#' + item.id === location.hash) ?? steps[0];
		const requested = new SvelteURLSearchParams(location.search).get('view');
		const view = next.views.find((id) => id === requested);
		const resolved = resolveView(next, { view });
		if (step !== next || selection?.view !== resolved.view)
			showStep(next, resolved, step ? moveMs : 0);
	}

	function changeView(view: string) {
		if (!step || !selection) return;
		selection = resolveView(step, { view, display: selection.display });
		stage?.setView(selection, moveMs);
	}

	function reset() {
		if (!step) return;
		showStep(step, resolveView(step), moveMs);
		if (new SvelteURLSearchParams(location.search).has('view'))
			writeLocation(step.id, undefined, true);
	}

	function selectView(view: string) {
		if (!step || !view || selection?.view === view) return;
		if (playing) showStep(step, resolveView(step), moveMs);
		changeView(view);
		writeLocation(step.id, view, true);
	}

	function play() {
		if (step?.control.kind !== 'playback') return;
		if (playing) return reset();
		playing = true;
		const { cues } = step.control;
		cues.forEach((cue, index) => {
			const reveal = () => {
				stage?.reveal(cue.phase);
				if (cue.view) changeView(cue.view);
				if (index === cues.length - 1) cancelPlayback();
			};
			if (cue.atMs === 0) reveal();
			else timers.push(setTimeout(reveal, cue.atMs));
		});
	}

	return {
		get step() {
			return step;
		},
		get selection() {
			return selection;
		},
		get seed() {
			return seed;
		},
		get error() {
			return error;
		},
		/** Marks the retained scene as unavailable when the renderer cannot start. */
		reportError(this: void) {
			error = true;
		},
		get playing() {
			return playing;
		},
		/** Attaches the stage and restores its current preset and selection. */
		attach(nextStage: ChapterStage) {
			stage = nextStage;
			if (step && selection) showStep(step, selection, 0);
		},
		/** Drops the stage and cancels pending playback cues. */
		detach() {
			cancelPlayback();
			stage = undefined;
		},
		syncLocation,
		/** Selects a step and pushes its anchor to the browser history. */
		selectStep(this: void, id: string) {
			const next = chapter().steps.find((item) => item.id === id);
			if (!next || next === step) return;
			showStep(next, resolveView(next), moveMs);
			writeLocation(next.id);
		},
		selectView,
		/** Applies an allowed display while retaining the current camera selection. */
		selectDisplay(this: void, display: string) {
			if (!step || !selection || !display || display === selection.display) return;
			selection = resolveView(step, { view: selection.view, display });
			stage?.setView(selection);
		},
		/** Cycles the active seed step through its preset list. */
		reroll(this: void) {
			if (step?.control.kind !== 'seed') return;
			const { seeds } = step.control;
			const index = seeds.indexOf(seed ?? step.preset.seed);
			seedOverride = seeds[(index + 1) % seeds.length];
			stage?.show({ ...step.preset, seed: seedOverride });
		},
		reset,
		play
	};
}

export type ChapterController = ReturnType<typeof createChapterController>;
