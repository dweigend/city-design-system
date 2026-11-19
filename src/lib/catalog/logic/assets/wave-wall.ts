import type { Vec3 } from '../parametrik/types';
import { surface } from './parts';
import type { ObjectGeometry } from './object-geometry';

const samples = 48;
// Four points at each station describe a closed, solid section of the glazed wall.
function course(
	bottom: number,
	top: number,
	cycles: number,
	depth: number,
	slot: string,
	raised = false
): ObjectGeometry {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const quad = (a: number, b: number, c: number, d: number) => triangles.push(a, b, c, a, c, d);
	for (let i = 0; i <= samples; i++) {
		const t = i / samples,
			y = (t - 0.5) * 2.5,
			wave = Math.sin(2 * Math.PI * t * cycles);
		const lip = depth + 0.065 * wave,
			crest = 0.14 * wave,
			sill = bottom + (raised ? crest : 0);
		points.push([0.015, y, sill], [lip, y, sill], [lip, y, top + crest], [0.015, y, top + crest]);
		if (i === 0) continue;
		const a = (i - 1) * 4,
			b = i * 4;
		for (let j = 0; j < 4; j++) {
			const k = (j + 1) % 4;
			quad(a + j, b + j, b + k, a + k);
		}
	}
	quad(0, 1, 2, 3);
	const end = 4 * samples;
	quad(end + 3, end + 2, end + 1, end);
	return { ...surface(slot), kind: 'mesh', points, triangles, lines: [] };
}
/** Models a solid wave relief with a projecting crest and recessed glazed bed. */
export function waveWall(factor: number, variant: number) {
	const cycles = 1 + variant * 0.5,
		height = 0.55 + factor * 1.55,
		shoulder = height * 0.86;
	return [
		course(0, shoulder, cycles, 0.31, 'glass'),
		course(shoulder, height, cycles, 0.37, 'channel', true)
	];
}
