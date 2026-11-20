import { expect, test } from 'bun:test';
import { Box2, Vector2, Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { acceptanceScene, createWorld, openingScene } from '../../logic/sandbox';
import { STORY } from '../../data/grid';
import { frameTownSilhouette, frameOldTown } from './opening-view';
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
	[1440, 900, 1050, 0, 820],
	[390, 844, 390, 142, 680]
])(
	'acceptance frames the whole occupied ensemble above the timeline at %d by %d',
	(width, height, right, top, bottom) => {
		const { world, additions } = acceptanceScene(7);
		const disc = additions.find((p) => p.kind === 'ring');
		if (disc?.kind !== 'ring') throw Error('Missing acceptance landmark');
		const view = createView();
		view.resize(width, height);
		const phone = width < height,
			area = { top, bottom, right };
		if (phone) frameOldTown(view, world, area);
		else frameTownSilhouette(view, world, area, additions);
		const courts = courtOpening(world, phone);
		if (!courts) throw Error('Missing occupied courts');
		const box = new Box2().setFromPoints(
			courts.points.map((p) => {
				const q = view.project([p.x, -p.z, p.y]);
				return new Vector2(q.x, q.y);
			})
		);
		const center = box.getCenter(new Vector2()),
			size = box.getSize(new Vector2());
		expect(center.x).toBeCloseTo(right / 2);
		expect(center.y).toBeCloseTo((top + bottom) / 2);
		expect(Math.max(size.x / right, size.y / (bottom - top))).toBeCloseTo(phone ? 0.6 : 0.64);
		expect(box.max.y).toBeLessThan(bottom);
		if (phone) expect(view.project(disc.position).x).toBeGreaterThan(right);
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

test.each([
	[900, 1075, 826],
	[600, 1075, 530],
	[807, 1440, 760]
])(
	'desktop transit landmarks clear the lower-left foreground at height %d',
	(height, right, bottom) => {
		const study = right === 1440 ? acceptanceScene(7) : openingScene(7);
		const view = createView();
		view.resize(1440, height);
		frameTownSilhouette(view, study.world, { right, bottom, top: 0 }, study.additions);
		const stops = study.world.lines.flatMap((line) =>
			line.stops.map((stop) => view.project(stop.position))
		);
		expect(stops.length).toBeGreaterThan(0);
		expect(
			stops.filter((p) => p.x >= 0 && p.x < right * 0.55 && p.y > bottom * 0.55 && p.y < height)
		).toHaveLength(0);
	}
);
