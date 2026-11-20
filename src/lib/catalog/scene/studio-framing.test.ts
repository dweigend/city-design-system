import { expect, test } from 'bun:test';
import { Box3, DirectionalLight, Vector3 } from 'three/webgpu';
import { createStudioLight } from './studio-light';
import { studioConfig } from './studio-quality';

test('studio model shadows cover every corner and use finer texels than the town camera', () => {
	const rig = createStudioLight(studioConfig('desktop'));
	const sun = rig.objects.find((o): o is DirectionalLight => o instanceof DirectionalLight);
	if (!sun) throw Error('Studio key missing');
	const bounds = new Box3(new Vector3(-8, 0, -5), new Vector3(12, 15, 9));
	const center = bounds.getCenter(new Vector3());
	const diagonal = bounds.getSize(new Vector3()).length();
	const camera = sun.shadow.camera;
	const texel = () => (2 * Math.max(camera.top, camera.right)) / sun.shadow.mapSize.width;
	try {
		rig.aim(center, diagonal);
		const townTexel = texel();
		rig.frame(bounds);
		expect(texel()).toBeLessThan(townTexel / 2);
		sun.updateMatrixWorld();
		sun.target.updateMatrixWorld();
		sun.shadow.updateMatrices(sun);
		for (const x of [bounds.min.x, bounds.max.x])
			for (const y of [bounds.min.y, bounds.max.y])
				for (const z of [bounds.min.z, bounds.max.z]) {
					const p = new Vector3(x, y, z).project(camera);
					expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(1);
				}
		rig.aim(center, diagonal);
		expect(texel()).toBe(townTexel);
	} finally {
		rig.dispose();
	}
});
