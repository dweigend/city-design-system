import { Box2, Vector2 } from 'three/webgpu';
import type { View } from './view';

export type OpeningProjection = {
	courts: Box2[];
	houses: Box2[][];
	landmarks: Box2[];
	stock: Box2[];
};
type OpeningScreen = { canvas: Box2; safe: Box2; foreground: Box2; reserved: Box2[] };

function obstructed(
	phone: boolean,
	data: OpeningProjection,
	canvas: Box2,
	safe: Box2,
	foreground: Box2,
	hud: Box2[]
) {
	const blocked = (b: Box2) => !safe.containsBox(b) || hud.some((zone) => zone.intersectsBox(b));
	if (
		data.landmarks.some(
			(b) => canvas.intersectsBox(b) && (phone || blocked(b) || foreground.intersectsBox(b))
		)
	)
		return true;
	if (data.courts.some((b) => canvas.intersectsBox(b) && blocked(b))) return true;
	return hud.some((zone) => data.stock.some((b) => zone.intersectsBox(b)));
}

function median(values: number[]) {
	values.sort((a, b) => a - b);
	const mid = Math.floor(values.length / 2);
	return values.length ? (values[mid] + values[Math.floor((values.length - 1) / 2)]) / 2 : 0;
}

function coverage(boxes: Box2[]) {
	return boxes.reduce((sum, b) => sum.union(b), new Box2());
}

function separation(boxes: Box2[]) {
	let worst = 0;
	for (const [i, box] of boxes.entries())
		for (const next of boxes.slice(i + 1)) {
			const overlap = box.clone().intersect(next).getSize(new Vector2());
			const a = box.getSize(new Vector2()),
				b = next.getSize(new Vector2());
			worst = Math.max(
				worst,
				(overlap.x * overlap.y) / Math.max(1e-8, Math.min(a.x * a.y, b.x * b.y))
			);
		}
	return worst;
}

/** Ranks unobstructed crops by house size, separation, margins and ensemble count. */
export function cameraScore(
	view: View,
	screen: OpeningScreen,
	indices: number[],
	data: OpeningProjection
) {
	const fit = coverage(indices.map((i) => data.courts[i]));
	const size = fit.getSize(new Vector2()),
		room = screen.safe.getSize(new Vector2());
	const scale = view.courtScale(size.x, size.y, room.x, room.y);
	const origin = fit
		.getCenter(new Vector2())
		.sub(screen.safe.getCenter(new Vector2()).divideScalar(scale));
	const inverse = (b: Box2) =>
		new Box2(
			b.min.clone().divideScalar(scale).add(origin),
			b.max.clone().divideScalar(scale).add(origin)
		);
	const canvas = inverse(screen.canvas),
		safe = inverse(screen.safe),
		foreground = inverse(screen.foreground);
	const hud = screen.reserved.map(inverse);
	if (obstructed(view.isPortrait(), data, canvas, safe, foreground, hud)) return;
	return readableCourts(data, safe, scale, room, view.isPortrait() ? 110 : 140);
}

function readableCourts(
	data: OpeningProjection,
	safe: Box2,
	scale: number,
	room: Vector2,
	target: number
) {
	const visible = data.courts.flatMap((b, i) => (safe.containsBox(b) ? [i] : []));
	const homes = visible.flatMap((i) => data.houses[i]);
	const height = median(homes.map((b) => (b.max.y - b.min.y) * scale));
	const bodies = visible.map((i) => coverage(data.houses[i]));
	const spread = coverage(bodies);
	const margin = (Math.max(spread.min.x - safe.min.x, safe.max.x - spread.max.x) * scale) / room.x;
	const verticalMargin =
		(Math.max(spread.min.y - safe.min.y, safe.max.y - spread.max.y) * scale) / room.y;
	const overlap = separation(bodies.map((b) => b.clone().expandByScalar(8 / scale)));

	return [
		Math.min(1, height / target),
		Number(visible.length >= 2),
		-overlap,
		-Math.max(0, margin - 0.15, verticalMargin - 0.15),
		visible.length,
		height
	];
}
