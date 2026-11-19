import type { SearchSettings } from '../../core/planning';
export type FrameGoal = Readonly<{
	id: string;
	literal: string;
	alternatives: readonly string[];
	created: number;
	houses: readonly string[];
}>;
export type FrameEvent = Readonly<{ goal: string; seam: string; tick: number }>;
export type PlanningContext = Readonly<{
	search?: Partial<Pick<SearchSettings, 'strategy' | 'width' | 'budget'>>;
	tick: number;
	lookback: number;
	lookahead: number;
	events: readonly FrameEvent[];
	observations: readonly { seam: string; from: number; reason: string }[];
}>;
export type Admission = (id: string, decisions: ReadonlyMap<string, { role: string }>) => boolean;
