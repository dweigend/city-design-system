import { Valley } from '../../../lib/domain/valley';
import { projectValley } from '../../../lib/scene/valley-projection';

export function run(phase: 'start' | 'comparison') {
	const valley = Valley.create({
		seed: 42,
		parameters: { sinuosity: 1.15, relief: 1, runoff: phase === 'start' ? 0.5 : 1.5 }
	});
	const { drawables } = projectValley(valley);
	let peakDischarge = 0;
	for (const reach of valley.reaches) {
		if (!reach.trunk) continue;
		for (const { discharge } of reach.stations) {
			peakDischarge = Math.max(peakDischarge, discharge);
		}
	}
	return {
		stage: {
			drawables,
			view: 'plan' as const,
			fit: { fill: 0.96 },
			label: 'Plan of the tributaries and side-lake in the valley'
		},
		args: { seed: valley.seed, ...valley.parameters },
		metric: { label: 'Peak river discharge', value: peakDischarge, unit: 'm³/s' }
	};
}
