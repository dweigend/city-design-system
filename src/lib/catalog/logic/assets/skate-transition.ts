import { surface } from './parts';
import { joinRings } from '../profile-fit';
import type { Vec3 } from '../parametrik/types';

/** A solid quarter pipe with a level rear platform and a tangent runout at deck height. */
export function skateTransition(factor: number) {
	const rise = 2.3 * factor;
	const sections = [[-2.42, rise + 0.18]];
	for (let i = 0; i <= 48; i++) {
		const a = (i * Math.PI) / 96;
		sections.push([-1.56 + 3.16 * (1 - Math.cos(a)), 0.18 + rise * (1 - Math.sin(a))]);
	}
	sections.push([2.42, 0.18]);
	const points: Vec3[] = [],
		triangles = [0, 2, 1, 0, 3, 2];
	for (const [i, [x, height]] of sections.entries()) {
		points.push([x, -1.32, 0], [x, 1.32, 0], [x, 1.32, height], [x, -1.32, height]);
		if (i > 0) joinRings(triangles, (i - 1) * 4, i * 4, 4);
	}
	const end = points.length - 4;
	triangles.push(end, end + 1, end + 2, end, end + 2, end + 3);
	return [{ ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] }];
}
