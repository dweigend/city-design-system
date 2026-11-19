import { area, clipPolygon, type HalfPlane, type Point2 } from '../ansicht/geometrie';
import { windingRoute } from './circulation';
import { edge } from './stair-track';
import { houseObject } from './house-object';
import type { Section } from './types';
import type { Surface } from './surfaces';

function cut(outline: Point2[], opening: HalfPlane[]) {
	let inside = outline;
	const outside: Point2[][] = [];
	if (area(opening.reduce(clipPolygon, outline)) < 1e-9) return [outline];
	for (const {
		normal: [x, y],
		d
	} of opening) {
		const piece = clipPolygon(inside, { normal: [-x, -y], d: -d });
		if (area(piece) > 1e-9) outside.push(piece);
		inside = clipPolygon(inside, { normal: [x, y], d });
	}
	return outside;
}

/** Follows the painted footprint at the first deck, leaving openings above ascending flights. */
export function plotDeck(s: Section, surface: Surface) {
	const [x, y] = s.stairAxis,
		z = s.decks[0].position[2];

	// Remove the full swept headroom even where the flight is vertical.
	const opening: HalfPlane[] = s.compact
		? [
				{ normal: [1, 0], d: x + 0.36 },
				{ normal: [-1, 0], d: -x + 0.36 },
				{ normal: [0, 1], d: y + 0.3 },
				{ normal: [0, -1], d: -y + 0.3 }
			]
		: windingRoute(s).track.map((p) => {
				const [u, v] = p.normal,
					[a, b] = edge(p, 0.625);
				return { normal: [u, v], d: u * a + v * b };
			});
	return s.cells.flatMap((cell) => {
		const outline = cell.corners.map(([x, y]): Point2 => [x, y]);
		const pieces = cut(outline, opening);
		const p = houseObject('landing', 'standard', s.seed, {
			instanceId: s.id + '/platform/' + cell.id,
			slots: { deck: surface }
		}).parts[0];
		if (p.kind !== 'prism') throw new Error('Expected a platform plate');
		return pieces.map((polygon, i) => ({
			...p,
			id: p.id + '/' + i,
			polygon,
			z: z - p.height,
			roofCell: cell.id
		}));
	});
}
