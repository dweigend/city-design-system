import { expect, test } from 'bun:test';
import { Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { createWorld } from '../../logic/sandbox';
import { frameOldTown } from './opening-view';
import { createView } from './view';

test('the seed-7 portrait opening frames the river and slope at 50 CSS pixels per anchor parcel', () => {
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

	const parcel = world.grid.cellsById.get('87/43');
	if (!parcel) throw new Error('Expected the reference parcel for seed 7');
	const xs = parcel.corners.map((corner) => project(corner).x);
	expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50);
	expect(project(parcel.center).y).toBeCloseTo((area.top + area.bottom) / 2);

	const visible = [...world.grid.cellsById.values()].filter(({ center }) => {
		const { x, y } = project(center);
		return x >= 0 && x <= width && y >= area.top && y < area.bottom - 8;
	});
	expect(visible.some(({ zone }) => zone === 'water')).toBe(true);
	expect(visible.some(({ zone }) => zone === 'scarp')).toBe(true);

	view.resize(1440, 900);
	expect(frameOldTown(view, world)).toBe(false);
});
