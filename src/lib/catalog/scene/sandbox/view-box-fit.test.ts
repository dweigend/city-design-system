import { expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three/webgpu';
import { createView } from './view';

test('fits a fixed plate throughout a turn at desktop and phone aspect ratios', () => {
	const bounds = new Box3(new Vector3(-1000, -24, -1000), new Vector3(1000, 96, 1000));
	const margin = 1.12;
	const plan = { headingRad: 0, elevationRad: Math.PI / 2 };
	const iso = { headingRad: Math.PI / 4, elevationRad: Math.atan(Math.SQRT1_2) };
	for (const [width, height] of [
		[850, 410],
		[390, 300]
	]) {
		const view = createView();
		view.resize(width, height);
		view.frameBox(bounds, margin, plan);
		view.frameBox(bounds, margin, iso, 480);
		const start = performance.now();

		for (const time of [0, 120, 240, 360, 480]) {
			view.stepBoxMove(start + time, false);
			for (const x of [bounds.min.x, bounds.max.x])
				for (const y of [bounds.min.y, bounds.max.y])
					for (const z of [bounds.min.z, bounds.max.z]) {
						const point = new Vector3(x, y, z).project(view.camera);
						expect(Math.max(Math.abs(point.x), Math.abs(point.y))).toBeLessThanOrEqual(
							1 / margin + 1e-8
						);
					}
		}
	}
});
