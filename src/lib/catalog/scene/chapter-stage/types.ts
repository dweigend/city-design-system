import type { ChapterPreset } from '../../data/chapters';
import type { ResolvedView } from '../../logic/view-modes';

/** Connects a chapter preset to a retained scene on a shared stage. */
export type ChapterStage = {
	/** Shows the requested seed, retaining the current camera. */
	show(preset: ChapterPreset): void;
	/** Sets the visible demo layers without changing the seeded state. */
	reveal(phase?: number): void;
	/** Applies a validated view, with camera motion measured in milliseconds. */
	setView(view: ResolvedView, durationMs?: number): void;
	/** Reframes the scene in a viewport sized in CSS pixels. */
	resize(width: number, height: number): void;
	/** Releases the resources owned by this stage. */
	dispose(): void;
};

/** Attaches a seeded stage to a canvas and reports renderer initialization failures. */
export type ChapterStageFactory = (
	canvas: HTMLCanvasElement,
	onError: () => void,
	seed: number
) => ChapterStage;
