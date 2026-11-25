import { Valley } from '../../../lib/domain/valley';
import { projectValley } from '../../../lib/scene/valley-projection';

export function run(phase: 'start' | 'comparison') {
	const valley = Valley.create({
		seed: 1201,
		parameters: { sinuosity: 1.15, relief: phase === 'start' ? 0 : 1, runoff: 1 }
	});
	const { drawables, contourStep } = projectValley(valley);
	return {
		stage: {
			drawables: drawables.filter(({ id }) => id === 'ground' || id === 'earth'),
			view: 'iso' as const,
			fit: { fill: 0.93 },
			label: 'Valley slopes and elevation contours'
		},
		args: { seed: valley.seed, ...valley.parameters },
		metric: { label: 'Contour interval', value: contourStep, unit: 'm' }
	};
}
