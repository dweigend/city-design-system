import type { FrameGoal, Forecast, PlanningContext, FrameEvent, BayState } from '../district-frame';
import type { BaySurvey, trimBay } from '../megastructure';
export type FrameInstallation = { bay: BaySurvey; result: ReturnType<typeof trimBay> };
export type PlanningControls = Pick<
	PlanningContext,
	'lookahead' | 'lookback' | 'search' | 'observations'
>;
export type FrameTimeline = {
	tick: number;
	goals: readonly FrameGoal[];
	events: readonly FrameEvent[];
	results: readonly FrameTick[];
	controls: PlanningControls;
};
export type FrameTick = Forecast & {
	status: 'committed' | 'waiting' | 'blocked';
	delta: { id: string; state: BayState }[];
};
