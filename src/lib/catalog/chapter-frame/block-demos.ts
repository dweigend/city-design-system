import { landscapeChapter, type ChapterStep } from '../data/chapters';
import { VALLEY_STUDY_GRID, valleyStudySnapshot } from '../logic/valley-study';
import type { ResolvedView, ViewRequest } from '../logic/view-modes';
import { measureRiverReach } from '../river-metrics-example';
import { resolveExampleView } from '../view-modes-example';

type BlockDemo = Readonly<{
	step: ChapterStep;
	resolve?: (policy: ChapterStep, request?: ViewRequest) => ResolvedView;
	measurement?: (seed: number) => string;
}>;

/** Connects each public example to its existing chapter stage and optional output readout. */
export const blockDemos: Readonly<Record<string, BlockDemo>> = {
	'logic/valley-study': { step: landscapeChapter.steps[1] },
	'view-modes-example': {
		step: landscapeChapter.steps[2],
		resolve: (_policy, request) => resolveExampleView(request)
	},
	'river-metrics-example': {
		step: landscapeChapter.steps[1],
		measurement(seed) {
			const { course } = valleyStudySnapshot(seed);
			const reach = measureRiverReach(course.xy, VALLEY_STUDY_GRID.windowM);
			return reach
				? `Sinuosity ${reach.ratio.toFixed(3)} · ${reach.borderHits} border contacts`
				: 'No reach in the window';
		}
	}
};
