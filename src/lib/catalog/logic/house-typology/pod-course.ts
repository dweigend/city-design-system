import { plotCovers } from '../parzelle';
import { roundFootprint } from '../building-envelope';
import { roomOnDeck } from './deck-outline';
import type { QuadCell } from '../quad-grid';
import type { Plan } from './types';

type XY = [number, number];

function fittedPod(cell: QuadCell, opening: XY[]) {
	const ring = cell.corners.map(([x, y]): XY => [x, y]);
	const xs = opening.map(([x]) => x),
		ys = opening.map(([, y]) => y);
	const x = (Math.min(...xs) + Math.max(...xs)) / 2,
		y = (Math.min(...ys) + Math.max(...ys)) / 2;
	const halfWidth = (Math.max(...xs) - Math.min(...xs)) / 2 + 0.24;
	const halfDepth = (Math.max(...ys) - Math.min(...ys)) / 2 + 0.24;
	const radius =
		Math.min(
			...ring.map((p, i) =>
				Math.hypot(p[0] - ring[(i + 1) % ring.length][0], p[1] - ring[(i + 1) % ring.length][1])
			)
		) * 0.45;
	for (const factor of [1, 0.75, 0.5]) {
		const polygon = roundFootprint(ring, radius * factor);
		if (
			!roomOnDeck(polygon, [], x, y, halfWidth, halfDepth) ||
			!plotCovers([cell], { ring: polygon, holes: [] }, 0)
		)
			continue;
		const neck: XY[] = [
			[x - halfWidth, y - halfDepth],
			[x + halfWidth, y - halfDepth],
			[x + halfWidth, y + halfDepth],
			[x - halfWidth, y + halfDepth]
		];
		return { chamber: { polygon, holes: [opening] }, neck: { polygon: neck, holes: [opening] } };
	}
}

/** Fits the ensemble's upper chamber to one lot; shared upper galleries keep their full span. */
export function podCourse(plan: Plan, opening: XY[], gallery?: number, wing?: number) {
	const { cells, programme } = plan.site;
	const top = programme.length - 1;
	if (!plan.pod || cells.length !== 1 || top < 2 || top === gallery || top === wing) return;
	return fittedPod(cells[0], opening);
}
