import { area, type Point2 } from '../ansicht/geometrie';
import type { Primitive } from '../parametrik/types';
import type { PublicSpace } from './court-life';
import { publicPaving } from './town-floor';

type Height = (x: number, y: number) => number;

function along(a: Point2, b: Point2, t: number): Point2 {
	return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function bankEdge(polygon: Point2[], relief: Height, index: number) {
	const [a, b, c, d] = [...polygon.slice(index), ...polygon.slice(0, index)];
	const depth = Math.hypot(d[0] - a[0], d[1] - a[1]);
	const rise = relief(...along(a, b, 0.5)) - relief(...along(d, c, 0.5));
	return { a, b, c, d, depth, rise };
}

/** Steps the steeper of the two unreserved edges, keeping the mouth and planted frontage open. */
export function courtTerrace(court: PublicSpace, relief: Height, ground: Height) {
	const rear = bankEdge(court.polygon, relief, 0);
	const side = bankEdge(court.polygon, relief, 1);
	const { a, b, c, d, depth, rise } = Math.abs(side.rise) > Math.abs(rear.rise) ? side : rear;
	const run = Math.min(1.8, depth - 12);
	if (run < 1.2 || Math.abs(rise) < 0.45) return { court, steps: [] };
	const band = (s: number, t: number) => [
		along(a, d, s),
		along(b, c, s),
		along(b, c, t),
		along(a, d, t)
	];
	const top = court.position[2];
	const start = run / depth;
	const polygon = band(start, 1);
	const maxSoil = Math.max(...band(0, start).map((p) => ground(...p)));
	const change = Math.max(
		Math.min(0, maxSoil + 0.05 - top),
		Math.max(-0.48, Math.min(0.48, rise / 2))
	);
	const count = Math.ceil(Math.abs(change) / 0.17);
	if (Math.abs(change) < 0.1) return { court, steps: [] };
	const steps = Array.from({ length: count }, (_, i): Primitive => {
		const face = band(start * (1 - (i + 1) / count), start * (1 - i / count));
		const z = Math.min(top, ...face.map((p) => ground(...p))) - 0.04;
		return {
			kind: 'prism',
			role: 'neu',
			...publicPaving,
			id: 'court/' + court.id + '/seat/step/' + i,
			polygon: face,
			z,
			height: top + (change * (i + 1)) / count - z
		};
	});
	return { court: { ...court, polygon, area: area(polygon) }, steps };
}
