import type { MeshForm, Vec3 } from '../parametrik/types';
import type { Bay } from './collage-bay';

/** A closed canopy along one bay edge. Its flat seat turns down over the eave.
 * The datum and drop are metres. The ordered cross sections require no random draws. */
export function drapedRoof(at: Bay, datum: number, drop: number): MeshForm {
	const points: Vec3[] = [];
	const triangles: number[] = [];
	const sections = 12;
	const thickness = drop * 0.14;
	const quad = (a: number, b: number, c: number, d: number) => triangles.push(a, b, c, a, c, d);
	for (let i = 0; i <= sections; i++) {
		const t = i / sections;
		const v = 0.4 - 0.56 * t;
		// The straight seat bears on the roof. Start the drape at its 5% wall setback.
		const bend = Math.max(0, (0.05 - v) / 0.21);
		const z = datum + thickness - drop * bend * bend;
		for (const [u, h] of [
			[0.05, z],
			[0.95, z],
			[0.95, z - thickness],
			[0.05, z - thickness]
		]) {
			points.push(at(u, v, h));
		}
		if (!i) continue;
		const prev = 4 * (i - 1);
		for (let j = 0; j < 4; j++) {
			const a = prev + j,
				b = prev + ((j + 1) % 4);
			quad(a, a + 4, b + 4, b);
		}
	}
	quad(0, 1, 2, 3);
	const end = sections * 4;
	quad(end + 3, end + 2, end + 1, end);
	const [a, b, , , c] = points;
	if ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]) < 0) {
		for (let i = 0; i < triangles.length; i += 3)
			[triangles[i + 1], triangles[i + 2]] = [triangles[i + 2], triangles[i + 1]];
	}
	return { kind: 'mesh', points, triangles, lines: [] };
}
