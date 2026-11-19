import { area, clipPolygon, type HalfPlane, type Point2 } from '../ansicht/geometrie';
import { circulation } from './circulation';
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
	const { legs, width } = circulation(s);
	const z = s.decks[0].position[2];
	const openings = legs.flatMap(({ from: a, to: b }) => {
		if (Math.min(a[2], b[2]) > z + 0.18 || Math.max(a[2], b[2]) + 2 < z) return [];
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			len = Math.hypot(dx, dy);
		if (len < 1e-8) return [];
		const u = dx / len,
			v = dy / len;
		return [
			[
				{ normal: [-u, -v], d: -u * a[0] - v * a[1] },
				{ normal: [u, v], d: u * b[0] + v * b[1] },
				{ normal: [-v, u], d: -v * a[0] + u * a[1] + width / 2 },
				{ normal: [v, -u], d: v * a[0] - u * a[1] + width / 2 }
			] satisfies HalfPlane[]
		];
	});
	return s.cells.flatMap((cell) => {
		const outline = cell.corners.map(([x, y]): Point2 => [x, y]);
		const pieces = openings.reduce(
			(rings, opening) => rings.flatMap((r) => cut(r, opening)),
			[outline]
		);
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
