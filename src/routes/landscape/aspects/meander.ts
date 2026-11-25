import { mesh } from '../../../lib/core/mesh';
import { sinuosity } from '../../../lib/domain/river-metrics';
import { channelPolygons, Valley } from '../../../lib/domain/valley';
import { landscape, type Drawable } from '../../../lib/scene/surface';

export function run(phase: 'start' | 'comparison') {
	const valley = Valley.create({
		seed: 1201,
		parameters: { sinuosity: phase === 'start' ? 1.04 : 1.28, relief: 0, runoff: 1 }
	});
	const channel = mesh();
	const trunk = valley.reaches.filter((reach) => reach.trunk);
	const cosine = Math.cos(valley.course.bearing);
	const sine = Math.sin(valley.course.bearing);
	for (const polygon of channelPolygons(trunk)) {
		// Put the downstream bearing along the horizontal axis of the plan.
		const positions = polygon.flatMap(([x, y, z]) => [
			x * cosine + y * sine,
			y * cosine - x * sine,
			z
		]);
		// Each channel strip or cap is convex, so a triangle fan fills it in plan.
		const indices = [];
		for (let i = 1; i < polygon.length - 1; i++) indices.push(0, i, i + 1);
		channel.append({ kind: 'mesh', positions, indices });
	}
	const shape = channel.shape();
	const drawables: Drawable[] = shape ? [{ id: 'meander', shape, ...landscape.water }] : [];
	return {
		stage: {
			drawables,
			view: 'plan' as const,
			fit: { fill: 0.9 },
			label: 'Plan of the isolated main river channel'
		},
		args: { seed: valley.seed, ...valley.parameters },
		metric: { label: 'Measured sinuosity', value: sinuosity(valley.course.xy) }
	};
}
