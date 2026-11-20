import type { OpeningProjection } from './opening-projection';
import { Box2, Vector2 } from 'three/webgpu';

function area(box: Box2) {
	const size = box.getSize(new Vector2());
	return size.x * size.y;
}

/** Rates the two-dimensional framing of complete built silhouettes in the usable HUD opening. */
export function ensembleComposition(
	bodies: Box2[],
	stock: Box2[],
	safe: Box2,
	scale: number,
	portrait = false
) {
	const frame = area(safe);
	const centre = safe.getCenter(new Vector2());
	const size = safe.getSize(new Vector2());
	const centralRegion = safe.clone().expandByVector(size.clone().multiplyScalar(-0.28));
	const subject = bodies.reduce((box, body) => box.union(body), new Box2());
	if (
		!safe
			.clone()
			.expandByScalar(-6 / scale)
			.containsBox(subject)
	)
		return;
	// The summed roof rectangles conservatively bound visible pencil area even when they overlap.
	const historic = stock.filter((b) => b.intersectsBox(safe)).map((b) => b.clone().intersect(safe));
	const stockShare = historic.reduce((sum, box) => sum + area(box), 0) / frame;
	if (stockShare > 0.2 || historic.some((box) => box.intersectsBox(centralRegion))) return;
	const extent = area(subject) / frame;
	const min = portrait ? 0.4 : 0.45;
	const max = portrait ? 0.5 : 0.58;
	if (historic.length && extent < min) return;
	const mass = bodies.reduce((sum, body) => sum + area(body), 0) / frame;
	const middle = subject.getCenter(new Vector2());
	const drift = middle.clone().sub(centre).divide(size).length();
	const gap = Math.min(...bodies.map((body) => body.distanceToPoint(middle))) / size.x;
	const penalty =
		Math.max(0, min - extent, extent - max) + Math.max(0, 0.21 - mass, drift - 0.12, gap - 0.1);
	return [1, -penalty, 1, -gap - drift * 0.35 + mass * 0.22, -Math.abs(extent - (min + max) / 2)];
}

function corners(box: Box2) {
	return [box.min, box.max, new Vector2(box.min.x, box.max.y), new Vector2(box.max.x, box.min.y)];
}

// A house can obscure the centre of a stock roof while its eaves still show beside it.
function exposedContext(
	boxes: Box2[],
	safe: Box2,
	obstacles: Box2[],
	spread: Box2,
	interior: Box2 | undefined
) {
	let exposed = false;
	for (const box of boxes) {
		if (!box.intersectsBox(safe)) continue;
		const patch = box.clone().intersect(safe);
		for (const point of corners(patch)) {
			if (obstacles.some((b) => b.containsPoint(point))) continue;
			exposed = true;
			spread.expandByPoint(point);
			if (!interior || spread.containsBox(interior)) return true;
		}
	}
	return exposed;
}

/** Requires uncovered landscape and, in the pencil or legacy crop, a visible historic roof. */
export function surroundings(
	data: OpeningProjection,
	homes: Box2[],
	hud: Box2[],
	safe: Box2,
	spread: Box2,
	requireStock: boolean
) {
	const obstacles = [...homes, ...hud];
	const interior = requireStock
		? safe.clone().expandByVector(safe.getSize(new Vector2()).multiplyScalar(-0.15))
		: undefined;
	if (
		requireStock &&
		data.stock.length &&
		!exposedContext(data.stock, safe, obstacles, spread, interior)
	)
		return false;
	return (
		!data.landscape.length || exposedContext(data.landscape, safe, obstacles, spread, interior)
	);
}
