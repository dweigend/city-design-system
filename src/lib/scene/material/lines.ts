import { materialSettings } from '../../../config/material';
import type { Vec2 } from '../../core/geometry';
import { clipToOutline, segmentOutside } from './cells';
import type { Frame } from './patch';
import type { Unit } from './prism';

const { planeToleranceM } = materialSettings;

function isOnOutline(a: Vec2, b: Vec2, outline: readonly Vec2[]) {
	return outline.some((p, i) => {
		const q = outline[(i + 1) % outline.length];
		const cross = (x: Vec2) => (q[0] - p[0]) * (x[1] - p[1]) - (q[1] - p[1]) * (x[0] - p[0]);
		return Math.abs(cross(a)) <= planeToleranceM && Math.abs(cross(b)) <= planeToleranceM;
	});
}

/** One line per joint: the left and lower edges of each clipped unit, outside the openings and
 * off the outline, lifted in front of the flat face. */
export function jointLines(frame: Frame, units: readonly Unit[], face: number): number[] {
	const lines: number[] = [];
	const openings = frame.patch.openings ?? [];
	for (const { slot, polygon } of units) {
		if (slot === 'joint') continue;
		const clipped = clipToOutline(polygon, frame.outline);
		for (const [i, a] of clipped.entries()) {
			const b = clipped[(i + 1) % clipped.length];
			const facesBack = b[1] - a[1] < -planeToleranceM || a[0] - b[0] < -planeToleranceM;
			if (!facesBack || isOnOutline(a, b, frame.outline)) continue;
			for (const [s, e] of segmentOutside(a, b, openings))
				lines.push(...frame.point(s[0], s[1], face), ...frame.point(e[0], e[1], face));
		}
	}
	return lines;
}
