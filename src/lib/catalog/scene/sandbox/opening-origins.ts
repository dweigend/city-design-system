import { Box2, Vector2 } from 'three/webgpu';
import type { OpeningProjection, OpeningScreen } from './opening-score';

function box(x: number, y: number, r: number, b: number) {
	return new Box2(new Vector2(x, y), new Vector2(r, b));
}

// A projected obstacle intersects a screen rectangle exactly within this rectangle of camera origins.
function intersections(body: Box2, region: Box2, scale: number) {
	return box(
		body.min.x - region.max.x / scale,
		body.min.y - region.max.y / scale,
		body.max.x - region.min.x / scale,
		body.max.y - region.min.y / scale
	);
}

function subtract(room: Box2, blocked: Box2) {
	if (!room.intersectsBox(blocked)) return [room];
	const { min, max } = room,
		cut = room.clone().intersect(blocked);
	return [
		box(min.x, min.y, cut.min.x, max.y),
		box(cut.max.x, min.y, max.x, max.y),
		box(cut.min.x, min.y, cut.max.x, cut.min.y),
		box(cut.min.x, cut.max.y, cut.max.x, max.y)
	].filter((b) => b.max.x > b.min.x && b.max.y > b.min.y);
}

function silhouetteLimits({ safe, canvas, reserved }: OpeningScreen) {
	return [
		...reserved,
		box(0, 0, canvas.max.x, safe.min.y),
		box(0, safe.max.y, canvas.max.x, canvas.max.y),
		box(safe.max.x, 0, canvas.max.x, canvas.max.y),
		box(0, 0, safe.min.x, canvas.max.y)
	];
}

function remaining(room: Box2[], bodies: Box2[], regions: Box2[], scale: number) {
	for (const body of bodies)
		for (const region of regions) {
			const cut = intersections(body, region, scale).expandByScalar(0.6 / scale);
			if (!room.some((b) => b.intersectsBox(cut))) continue;
			room = room.flatMap((b) => subtract(b, cut));
			if (!room.length) return room;
		}
	return room;
}

/** Finds legal camera origins where a complete group and part of a stock roof can share the image. */
export function* stockOrigins(
	fit: Box2,
	screen: OpeningScreen,
	data: OpeningProjection,
	scale: number,
	phone: boolean
) {
	const { safe } = screen;
	const domain = box(
		fit.max.x - safe.max.x / scale,
		fit.max.y - safe.max.y / scale,
		fit.min.x - safe.min.x / scale,
		fit.min.y - safe.min.y / scale
	);
	if (domain.isEmpty()) return;
	const stock = data.stock
		.map((b) =>
			intersections(b, safe, scale)
				.expandByScalar(-4 / scale)
				.intersect(domain)
		)
		.filter((b) => !b.isEmpty());
	if (!stock.length) return;
	const edges = silhouetteLimits(screen);
	let room = remaining(
		[domain],
		data.landmarks,
		phone ? [screen.canvas] : [...edges, screen.foreground],
		scale
	);
	room = remaining(room, data.courts, edges, scale);
	room = remaining(room, data.stock, screen.reserved, scale);
	yield* distinctOrigins(room, stock, domain.getCenter(new Vector2()), scale);
}

function* distinctOrigins(room: Box2[], stock: Box2[], aim: Vector2, scale: number) {
	const seen = new Set<string>();
	for (const free of room) {
		for (const historic of stock) {
			if (!free.intersectsBox(historic)) continue;
			const legal = free.clone().intersect(historic);
			for (const point of [legal.clampPoint(aim, new Vector2()), legal.getCenter(new Vector2())]) {
				// Subpixel translations yield the same apparent crop.
				const key = Math.round(point.x * scale * 4) + ',' + Math.round(point.y * scale * 4);
				if (seen.has(key)) continue;
				seen.add(key);
				yield point;
			}
		}
	}
}
