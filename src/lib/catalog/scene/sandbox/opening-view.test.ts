import { expect, test } from 'bun:test';
import { Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { createWorld } from '../../logic/sandbox';
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
