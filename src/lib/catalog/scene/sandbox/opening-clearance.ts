import { Box2, Vector2 } from 'three/webgpu';
import type { World } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import {
	projectScene,
	screenBounds,
	surveyContext,
	type Courts,
	type OpeningProjection
} from './opening-projection';
import { scoreCrop } from './opening-score';
import type { OpeningArea, View } from './view';

function edgeOffsets(box: Box2, size: Vector2, origin: Vector2, scale: number) {
	return [
		new Vector2((origin.x - box.max.x) * scale - 2, 0),
		new Vector2(size.x + (origin.x - box.min.x) * scale + 2, 0),
		new Vector2(0, (origin.y - box.max.y) * scale - 2),
		new Vector2(0, size.y + (origin.y - box.min.y) * scale + 2)
	];
}

// At maximum span, first try clearing individual landmarks or stock silhouettes.
// The union supplies a legal last resort even if the HUD covers the entire town.
function outsideOffsets(data: OpeningProjection, size: Vector2, origin: Vector2, scale: number) {
	const boxes = [...data.landmarks, ...data.stock, ...data.courts];
	const union = boxes.reduce((all, b) => all.union(b), new Box2());
	return [...boxes, union]
		.flatMap((box) => edgeOffsets(box, size, origin, scale))
		.sort((a, b) => a.lengthSq() - b.lengthSq());
}

/** Widens an obstructed town crop and only installs an offset that passes the shared clearance test. */
export function clearTownOpening(
	view: View,
	world: World,
	courts: Courts,
	area?: OpeningArea,
	additions: readonly Primitive[] = []
) {
	const surroundings = surveyContext(world, additions);
	const screen = screenBounds(view, area);
	const center = screen.canvas.getCenter(new Vector2());
	const focus = screen.safe.getCenter(new Vector2());
	const room = screen.safe.getSize(new Vector2());
	const nearby = [0, -0.125, 0.125].flatMap((x) =>
		[0, -0.25, 0.25].map((y) => new Vector2(x * room.x, y * room.y))
	);
	const size = screen.canvas.getSize(new Vector2());
	const data = projectScene(view, courts, surroundings);
	const origin = center.clone().multiplyScalar(-view.metersPerPixel());
	let widest = false;
	for (;;) {
		const scale = 1 / view.metersPerPixel();
		const offsets = widest ? outsideOffsets(data, size, origin, scale) : nearby;
		const offset = offsets.find((delta) => {
			return scoreCrop(
				view,
				screen,
				data,
				scale,
				origin.clone().addScaledVector(delta, -1 / scale)
			);
		});
		if (offset) {
			if (offset.lengthSq()) view.pan(offset.x, offset.y);
			return true;
		}
		if (widest) {
			// A landmark can physically enclose the only stock. Clear the image and report no fit.
			const empty = offsets.find((delta) =>
				scoreCrop(
					view,
					screen,
					data,
					scale,
					origin.clone().addScaledVector(delta, -1 / scale),
					'clearance'
				)
			);
			if (empty) view.pan(empty.x, empty.y);
			return false;
		}
		const span = view.span();
		view.zoomAt(1.2, focus.x, focus.y);
		origin.addScaledVector(focus, 1 / scale - view.metersPerPixel());
		widest = view.span() === span;
	}
}
