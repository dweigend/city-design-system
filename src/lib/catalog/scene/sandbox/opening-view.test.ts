import { expect, test } from 'bun:test';
import { Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { createWorld } from '../../logic/sandbox';
import { frameOldTown } from './opening-view';
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
