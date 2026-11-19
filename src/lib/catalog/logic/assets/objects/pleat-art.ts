import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';
import { joinRings } from '../../profile-fit';
import { row } from '../assembly';
import { panel } from './forms';

// A contour in elevation gives the glass leaves their shared wave; each leaf is solid stock.
function leaf(x: number, height: number) {
	const points: Vec3[] = [],
		triangles = [0, 2, 1, 0, 3, 2];
	for (let i = 0; i <= 48; i++) {
		const t = i / 48,
			centre = x + 0.15 * Math.sin(t * 3 * Math.PI);
		const z = 0.18 + t * height;
		points.push(
			[centre - 0.06, -0.45, z],
			[centre + 0.06, -0.45, z],
			[centre + 0.06, 0.45, z],
			[centre - 0.06, 0.45, z]
		);
		if (i) joinRings(triangles, (i - 1) * 4, i * 4, 4);
	}
	const end = points.length - 4;
	triangles.push(end, end + 1, end + 2, end, end + 2, end + 3);
	return { ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] };
}
/** Sets identical wavy glass leaves into one low plinth, after the v3 glass stack. */
export function pleatedGlass(factor: number, variant: number) {
	const count = 3 + variant,
		spacing = 0.32;
	return [
		panel(0, 0, 0, (count - 1) * spacing + 0.52, 1.15, 0.18, 'foot'),
		...row(count, (t) => leaf((t * (count - 1) * spacing) / 2, 1.1 + factor * 1.65))
	];
}
