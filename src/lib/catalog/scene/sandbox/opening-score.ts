import type { OpeningProjection, OpeningScreen } from './opening-projection';
import { ensembleComposition, surroundings } from './opening-composition';
import { Box2, Vector2 } from 'three/webgpu';
import type { View } from './view';

const desktopSizes = {
	min: 140,
	max: 320,
	low: 180,
	high: 220,
	ideal: 200,
	samples: [140.1, 181, 200, 219]
};
const phoneSizes = {
	min: 110,
	max: Infinity,
	low: 110,
	high: 155,
	ideal: 135,
	samples: [110.1, 120, 135]
};
/** Projected house heights in CSS pixels, shared by the crop search and its final clearance check. */
export function houseSizes(portrait: boolean) {
	return portrait ? phoneSizes : desktopSizes;
}

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

function separated(boxes: Box2[], gap: number) {
	return boxes.every((box, i) => {
		const padded = box.clone().expandByScalar(gap);
		return boxes.slice(i + 1).every((other) => !padded.intersectsBox(other));
	});
}

/** Applies the same clearance and house-size limits to a fitted or a fallback camera. */
export function scoreCrop(
	view: View,
	screen: OpeningScreen,
	data: OpeningProjection,
	scale: number,
	origin: Vector2,
	mode: 'context' | 'rank' | 'clearance' = 'context'
) {
	const room = screen.safe.getSize(new Vector2());
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
	return readableCourts(
		data,
		{ safe, scale, room, hud, sizes: houseSizes(view.isPortrait()) },
		mode
	);
}

function readableGroup(
	data: OpeningProjection,
	bodies: Box2[],
	height: number,
	scale: number,
	sizes: typeof desktopSizes
) {
	return (
		height >= sizes.min &&
		bodies.length >= Math.min(2, data.courts.length) &&
		separated(bodies, 12 / scale)
	);
}

function apparentHeight(data: OpeningProjection, homes: Box2[], safe: Box2, scale: number) {
	const measured = !data.courts.length ? data.stock.filter((b) => safe.containsBox(b)) : homes;
	return median(measured.map((b) => (b.max.y - b.min.y) * scale));
}

type Crop = { safe: Box2; scale: number; room: Vector2; hud: Box2[]; sizes: typeof desktopSizes };
type ScoreMode = 'context' | 'rank' | 'clearance';

function readableCourts(data: OpeningProjection, crop: Crop, mode: ScoreMode) {
	const { safe, scale, sizes } = crop;
	const visible = data.courts.flatMap((b, i) => (safe.containsBox(b) ? [i] : []));
	const homes = visible.flatMap((i) => data.houses[i]);
	const height = apparentHeight(data, homes, safe, scale);
	if (height > sizes.max) return;
	if (mode === 'clearance') return [];
	if (data.courts.length && !visible.length) return;
	const bodies = visible.map((i) => coverage(data.houses[i]));
	if (mode === 'rank' && !readableGroup(data, bodies, height, scale, sizes)) return;
	return sceneComposition(data, crop, { visible, homes, bodies, height }, mode);
}

function sceneComposition(
	data: OpeningProjection,
	crop: Crop,
	group: {
		visible: number[];
		homes: Box2[];
		bodies: Box2[];
		height: number;
	},
	mode: ScoreMode
) {
	const { visible, homes, bodies, height } = group;
	const portrait = crop.sizes === phoneSizes;
	if (portrait && bodies.length > 2) return;
	const built = bodies.length >= Math.min(2, data.courts.length) && bodies.length > 0;
	const spread = coverage(bodies);
	if (!surroundings(data, homes, crop.hud, crop.safe, spread, !built)) return;
	if (built) return ensembleComposition(bodies, data.stock, crop.safe, crop.scale, portrait);
	if (mode === 'context') return [];
	const courtBox = coverage(visible.map((i) => data.courts[i]));
	return rankComposition({ ...crop, spread, bodies, courtBox, height });
}

function rankComposition({
	safe,
	spread,
	bodies,
	courtBox,
	height,
	scale,
	room,
	sizes
}: {
	safe: Box2;
	spread: Box2;
	bodies: Box2[];
	courtBox: Box2;
	height: number;
	scale: number;
	room: Vector2;
	sizes: typeof desktopSizes;
}) {
	const margin = (Math.max(spread.min.x - safe.min.x, safe.max.x - spread.max.x) * scale) / room.x;
	const verticalMargin =
		(Math.max(spread.min.y - safe.min.y, safe.max.y - spread.max.y) * scale) / room.y;
	if (Math.max(margin, verticalMargin) > 0.15) return;
	const centerOffset =
		(Math.abs(courtBox.getCenter(new Vector2()).y - safe.getCenter(new Vector2()).y) * scale) /
		room.y;
	const distance = Math.max(0, sizes.low - height, height - sizes.high);
	return [
		Number(separated(bodies, 16 / scale)),
		-distance,
		Number(centerOffset <= 0.065),
		bodies.length,
		-Math.abs(height - sizes.ideal)
	];
}
