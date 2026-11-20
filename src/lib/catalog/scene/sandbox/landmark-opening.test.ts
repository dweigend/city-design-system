import { expect, test } from 'bun:test';
import { Box2, Vector2 } from 'three/webgpu';
import {
	acceptanceScene,
	composedProjection,
	houseGroups,
	openingScene
} from '../../logic/sandbox';
import type { World } from '../../logic/sandbox';
import { focuses } from '../../logic/presentation';
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

function hud(name: string, w: number, h: number, right: number, top: number, bottom: number) {
	if (name === 'acceptance-phone') return [];
	if (name === 'acceptance') return [{ left: 16, top: bottom, right: 590, bottom: h - 8 }];
	if (name === 'sandbox-phone')
		return [
			{ left: 8, top: 8, right: 126, bottom: 121 },
			{ left: 241, top: 8, right: 382, bottom: top },
			{ left: 8, top: bottom, right: 382, bottom: h - 8 }
		];
	return [
		{ left: 8, top: 8, right: 158, bottom: 141 },
		{ left: w - 434, top: 16, right: w - 16, bottom: 61 },
		{ left: right, top: h / 2 - 252, right: w - 16, bottom: h / 2 + 252 },
		{ left: 16, top: h - 77, right: 665, bottom: h - 16 }
	];
}
function expectStockClear(world: World, view: View, hudBoxes: Box2[]) {
	const chunks = new Set([...world.grid.cellsById.values()].map((cell) => cell.chunk));
	for (const chunk of chunks)
		for (const parts of houseGroups(world, chunk, focuses.all).values()) {
			const stock = parts.filter((p) => p.role === 'bestand');
			if (!stock.length) continue;
			const box = envelope(view, stock);
			expect(hudBoxes.some((r) => r.intersectsBox(box))).toBe(false);
		}
}
test.each([
	['sandbox', 1440, 900, 1257, 0, 900],
	['sandbox-short', 1280, 640, 1097, 0, 640],
	['acceptance', 1440, 807, 1440, 0, 760],
	['sandbox-phone', 390, 844, 390, 150, 738],
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
			area = { right, top, bottom, reserved: hud(name, width, height, right, top, bottom) };
		const hudBoxes = area.reserved.map(
			(r) => new Box2(new Vector2(r.left, r.top), new Vector2(r.right, r.bottom))
		);
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
		expect(visible.length).toBeGreaterThanOrEqual(2);
		for (const box of visible) {
			expect(safe.containsBox(box)).toBe(true);
			expect(hudBoxes.some((zone) => zone.intersectsBox(box))).toBe(false);
			expect(
				visible.some(
					(other) => other !== box && other.clone().expandByScalar(12).intersectsBox(box)
				)
			).toBe(false);
		}
		const spread = visible.reduce((sum, box) => sum.union(box), new Box2());
		expect(Math.max(spread.min.x, right - spread.max.x) / right).toBeLessThanOrEqual(0.15);
		expect(
			Math.max(spread.min.y - top, bottom - spread.max.y) / (bottom - top)
		).toBeLessThanOrEqual(0.15);
		const heights = houses
			.map((h) => envelope(view, h.parts()))
			.filter((b) => safe.containsBox(b))
			.map((b) => b.max.y - b.min.y)
			.sort((a, b) => a - b);
		const median =
			(heights[Math.floor(heights.length / 2)] + heights[Math.floor((heights.length - 1) / 2)]) / 2;
		expect(median).toBeGreaterThanOrEqual(phone ? 110 : 140);
		expectStockClear(world, view, hudBoxes);
	}
);
