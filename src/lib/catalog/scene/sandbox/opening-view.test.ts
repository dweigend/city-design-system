import { expect, test } from 'bun:test';
import { Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { acceptanceScene, createWorld, TWO_SUNS_TURNING_DISC } from '../../logic/sandbox';
import { STORY } from '../../data/grid';
import { frameTownSilhouette, frameOldTown } from './opening-view';
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

test('two central parcels fill 70 percent of the desktop opening despite a distant parcel', () => {
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
	expect(fill).toBeCloseTo(0.7, 3);
});

test('the acceptance landmark stays inside the crop without widening the district', () => {
	const { world, additions } = acceptanceScene(7);
	const disc = additions.find((p) => p.id === TWO_SUNS_TURNING_DISC);
	if (disc?.kind !== 'ring') throw new Error('Seed 7 requires the coloured disc');
	const mark = disc.position;
	for (const [width, height] of [
		[1440, 900],
		[390, 640]
	]) {
		const view = createView();
		view.resize(width, height);
		const fit = (landmark?: Vec3) =>
			width < height
				? frameOldTown(view, world, undefined, landmark)
				: frameTownSilhouette(view, world, landmark);
		fit();
		const span = view.span();
		fit(mark);
		expect(view.span()).toBe(span);
		const pixel = view.project(mark);
		expect(Math.abs(pixel.x / width - 0.5)).toBeLessThan(0.37);
		expect(Math.abs(pixel.y / height - 0.5)).toBeLessThan(0.37);
	}
});
