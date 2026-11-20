import type { Level, Plan, Solid } from './types';
import { mounted, objectSlot } from './objects';

function stock(plan: Plan, stations: number[]) {
	if (plan.type === 'lattice-head')
		return { name: 'mast-course', variant: 'light', axes: [plan.site.center[0]] };
	if (plan.type === 'portal-house' || plan.type === 'bridge-house')
		return { name: 'bridge-pier', variant: 'twin', axes: stations };
}

/** Fits whole, uniformly scaled shaft courses between the entry and the first elevated body. */
export function shaftCourses(plan: Plan, level: Level, stations: number[], top: number) {
	const choice = stock(plan, stations);
	if (!choice || level.position[2] <= plan.datum) return;
	if (choice.axes.length > 1 && stations[1] - stations[0] < 1.45) return;
	const rise = top - plan.datum;
	for (const course of [6, 4, 2]) {
		const n = Math.max(1, Math.round(rise / course)),
			scale = rise / (n * course);
		if (scale < 0.85 || scale > 1.15) continue;
		const members: Solid[] = [];
		for (const [axis, x] of choice.axes.entries())
			for (let i = 0; i < n; i++) {
				const id = plan.site.id + '/shaft/' + axis + '/' + i;
				const b = objectSlot(
					id,
					'bearing',
					['kit-' + choice.name + '-' + course + 'm', choice.variant, 'workshop'],
					'material',
					plan.seed,
					0
				);
				b.scale = scale;
				b.size = [b.nativeSize[0] * scale, b.nativeSize[1] * scale, b.nativeSize[2] * scale];
				b.position = [x, plan.rear - plan.sign * 1.25, plan.datum + i * course * scale];
				members.push(mounted(b, plan.site.ground, 'beam'));
			}
		return members;
	}
}
