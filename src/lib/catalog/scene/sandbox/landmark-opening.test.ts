import { expect, test } from 'bun:test';
import { Box2, Vector2 } from 'three/webgpu';
import { acceptanceScene, composedProjection, openingScene } from '../../logic/sandbox';
import { bounds } from '../../logic/ansicht/geometrie';
import type { Primitive } from '../../logic/parametrik/types';
import { lineParts } from '../../logic/transit-line';
import { roundedStops } from './station-rings';
import { createView, type View } from './view';
import { frameOldTown, frameTownSilhouette } from './opening-view';

function envelope(view: View, parts: Primitive[]) {
	const box = new Box2();
	for (const part of parts) {
		const { min, max } = bounds(part);
		for (const x of [min[0], max[0]])
			for (const y of [min[1], max[1]])
				for (const z of [min[2], max[2]]) {
					const p = view.project([x, y, z]);
					box.expandByPoint(new Vector2(p.x, p.y));
				}
	}
	return box;
}

test.each([
	['sandbox', 1440, 900, 1075, 82, 826],
	['sandbox-short', 1440, 600, 1075, 82, 530],
	['acceptance', 1440, 807, 1440, 0, 760],
	['sandbox-phone', 390, 844, 390, 142, 680],
	['acceptance-phone', 390, 710, 390, 0, 710]
] as const)(
	'%s opens on whole houses and whole transit landmarks',
	(name, width, height, right, top, bottom) => {
		const { world, additions } = name.startsWith('acceptance')
			? acceptanceScene(7)
			: openingScene(7);
		const view = createView();
		view.resize(width, height);
		const phone = width < height,
			area = { right, top, bottom };
		(phone ? frameOldTown : frameTownSilhouette)(view, world, area, additions);
		const canvas = new Box2(new Vector2(), new Vector2(width, height));
		const safe = new Box2(new Vector2(0, top), new Vector2(right, bottom));
		const forbidden = new Box2(
			new Vector2(0, top + (bottom - top) * 0.55),
			new Vector2(right * 0.55, bottom)
		);
		const stations = world.lines.map((line) => roundedStops(lineParts(line)));
		expect(stations.length).toBeGreaterThan(0);
		for (const parts of [...stations, additions].filter((group) => group.length)) {
			const box = envelope(view, parts);
			if (!canvas.intersectsBox(box)) continue;
			expect(phone, parts[0].id).toBe(false);
			expect(safe.containsBox(box), parts[0].id).toBe(true);
			expect(forbidden.intersectsBox(box), parts[0].id).toBe(false);
		}
		const houses = composedProjection(world).filter((h) => !h.span);
		const courts = world.state.city?.centres.flatMap((c) => c.ensembles ?? []) ?? [];
		const boxes = courts.map((court) =>
			envelope(
				view,
				houses
					.filter((h) => h.cells.some((id) => court.lots.includes(id)))
					.flatMap((h) => h.parts())
			)
		);
		const visible = boxes.filter((box) => canvas.intersectsBox(box));
		expect(visible.length).toBeGreaterThanOrEqual(phone ? 2 : 4);
		for (const box of visible) expect(safe.containsBox(box)).toBe(true);
	}
);
