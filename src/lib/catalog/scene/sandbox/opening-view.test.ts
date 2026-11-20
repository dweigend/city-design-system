import { expect, test } from 'bun:test';
import { Box2, Vector2, Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { acceptanceScene, createWorld, openingScene } from '../../logic/sandbox';
import { STORY } from '../../data/grid';
import { frameTownSilhouette, frameOldTown } from './opening-view';
import { boxCorners, openingLandmarks } from './opening-landmarks';
import { courtOpening } from './court-opening';
import { createView } from './view';

test('the seed-7 portrait opening keeps the river and slope visible in the opening area', () => {
	const width = 390;
	const height = 844;
	const area = { top: 142, bottom: 680 };
	const view = createView();
	const world = createWorld(7);
	const project = ([x, y, z]: Vec3) => {
		const point = new Vector3(x, z, -y).project(view.camera);
		return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 };
	};
	view.resize(width, height);
	expect(frameOldTown(view, world, area)).toBe(true);

	const visible = [...world.grid.cellsById.values()].filter(({ center }) => {
		const { x, y } = project(center);
		return x >= 0 && x <= width && y >= area.top && y < area.bottom;
	});
	expect(visible.some(({ zone }) => zone === 'water')).toBe(true);
	expect(visible.some(({ zone }) => zone === 'scarp')).toBe(true);

	view.resize(1440, 900);
	expect(frameOldTown(view, world)).toBe(false);
});

test('two central parcels fill 77 percent of the desktop opening despite a distant parcel', () => {
	const source = createWorld(7);
	const cells = [...source.grid.cellsById.values()];
	const near = cells[0];
	const neighbour = cells.find(
		(c) => Math.hypot(c.center[0] - near.center[0], c.center[1] - near.center[1]) > 100
	);
	if (!neighbour) throw Error('Fixture requires two separated occupied parcels');
	const remote = cells[cells.length - 1];
	const world = {
		...source,
		state: {
			...source.state,
			stacks: new Map([near, neighbour, remote].map((cell) => [cell.id, ['living'] as const]))
		}
	};
	const view = createView();
	view.resize(1440, 900);
	expect(frameTownSilhouette(view, world)).toBe(true);
	const points = [near, neighbour].flatMap((cell) =>
		cell.corners.flatMap(([x, y, z]) => [
			view.project([x, y, z]),
			view.project([x, y, cell.pad + STORY])
		])
	);
	const range = (values: number[]) => Math.max(...values) - Math.min(...values);
	const fill = Math.max(
		range(points.map((point) => point.x)) / 1440,
		range(points.map((point) => point.y)) / 900
	);
	expect(fill).toBeCloseTo(0.77, 3);
});

test.each([
	[1440, 900, 1050],
	[390, 844, 390]
])(
	'whole landmarks and courts fit the %d by %d viewport with right edge %d',
	(width, height, right) => {
		const { world, landmark, landmarkBounds } = acceptanceScene(7);
		if (!landmark || !landmarkBounds) throw Error('Missing landmark geometry');
		const view = createView();
		view.resize(width, height);
		const phone = width < height;
		const area = phone ? { top: 142, bottom: 680, right } : { top: 0, bottom: height, right };
		if (phone) frameOldTown(view, world, area, landmark, landmarkBounds);
		else frameTownSilhouette(view, world, landmark, area, landmarkBounds);
		const courts = courtOpening(world, phone, landmark);
		if (!courts) throw Error('Missing occupied courts');
		for (const p of [...courts.points, ...boxCorners(landmarkBounds)]) {
			const pixel = view.project([p.x, -p.z, p.y]);
			expect(pixel.x).toBeWithin(0, right);
			expect(pixel.y).toBeWithin(area.top, area.bottom);
		}
		for (const group of openingLandmarks(world)) {
			const crop = new Box2(new Vector2(0, area.top), new Vector2(right, area.bottom));
			const box = new Box2().setFromPoints(
				group.map((p) => {
					const { x, y } = view.project([p.x, -p.z, p.y]);
					return new Vector2(x, y);
				})
			);
			expect(crop.containsBox(box) || !crop.intersectsBox(box)).toBe(true);
		}
	}
);

test('the desktop opening without ensemble data retains occupied parcels and central water', () => {
	const source = openingScene(7).world;
	const world = { ...source, state: { ...source.state, city: undefined } };
	const view = createView();
	view.resize(1440, 900);
	frameTownSilhouette(view, world);
	const waterfront = world.grid.cells
		.filter((cell) => cell.zone === 'water')
		.map((cell) => view.project(cell.center));
	expect(waterfront.some((p) => p.x > 648 && p.x < 792 && p.y > 0 && p.y < 900)).toBe(true);
	const visible = [...world.state.stacks.keys()].filter((id) => {
		const cell = world.grid.cellsById.get(id);
		if (!cell) throw Error('Missing occupied parcel');
		const p = view.project(cell.center);
		return p.x > 0 && p.x < 1440 && p.y > 0 && p.y < 900;
	});
	expect(visible.length).toBeGreaterThan(5);
});

test('occupied parcels and central water share the legacy portrait HUD opening', () => {
	const source = openingScene(7).world;
	const world = { ...source, state: { ...source.state, city: undefined } };
	const view = createView();
	view.resize(390, 844);
	const area = { top: 142, bottom: 680 };
	frameOldTown(view, world, area);
	const visible = world.grid.cells.filter((cell) => {
		const p = view.project(cell.center);
		return p.x > 175.5 && p.x < 214.5 && p.y > area.top && p.y < area.bottom;
	});
	expect(visible.some((c) => c.zone === 'water')).toBe(true);
	expect(visible.some((c) => world.state.stacks.has(c.id))).toBe(true);
});
