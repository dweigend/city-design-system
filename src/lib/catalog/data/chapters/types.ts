import type { ViewMode, ViewPolicy } from '../view-modes';

/** Seeded scene preset used by a chapter step. */
export type ChapterPreset = Readonly<{
	scene: 'valley' | 'acceptance' | 'style-houses';
	seed: number;
}>;

type DemoCue = Readonly<{ atMs: number; phase: number; view?: ViewMode }>;

type StepControl = Readonly<
	{ hint: string } & (
		| { kind: 'playback'; cues: readonly [DemoCue, ...DemoCue[]] }
		| { kind: 'seed'; seeds: readonly [number, ...number[]] }
		| { kind: 'view' }
	)
>;

/** Declarative copy and stage policy for one chapter step. */
export type ChapterStep = ViewPolicy &
	Readonly<{
		id: `step-${number}`;
		label?: string;
		title: string;
		principles: readonly string[];
		preset: ChapterPreset;
		control: StepControl;
		caption: string;
		details: Readonly<{ label: string; text: string }>;
	}>;

/** Content rendered by the shared chapter frame. */
export type Chapter = Readonly<{
	number: number;
	slug: string;
	title: string;
	summary: string;
	libraryDocs?: Readonly<{ index: ChapterStep['id']; steps: readonly ChapterStep['id'][] }>;
	steps: readonly [ChapterStep, ...ChapterStep[]];
}>;
