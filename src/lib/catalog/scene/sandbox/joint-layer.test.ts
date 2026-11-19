import { expect, test } from 'bun:test';
import { Mesh } from 'three/webgpu';
import { createWorld } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import { sandboxStyle } from './drafting-style';
import { loadStructureModules } from './fixtures/structure-modules';

const base = { token: '--paper', material: 'metal', role: 'traeger' } as const;
const column = (id: string, x: number): Primitive => ({
	...base,
	id,
	kind: 'cylinder',
	position: [x, 0, 100],
	radius: 0.1,
	height: 2
});
const chord: Primitive = {
	...base,
	id: 'chord',
	kind: 'pipe',
	points: [
		[-2, 0, 102],
		[2, 0, 102]
	],
	radius: 0.15
};

test('separate structure keys share one close-zoom ink draw and clear with the scene', async () => {
	const [, , { createStructures }] = await loadStructureModules();
	const structures = createStructures();
	const { grid, state } = createWorld(7);
	const style = sandboxStyle({ zoom: 'haus', modus: 'ansehen', situation: 'normal' });
	const fit = () => structures.group.getObjectByName('Structural joints');
	try {
		structures.set('first', [column('first', -1)]);
		structures.set('second', [column('second', 1)]);
		structures.set('chord', [chord]);
		structures.setStyle([style, 'primary', 21], Math.PI / 4);
		structures.setJointView(grid, state.year, true);
		structures.step(0, true);
		const mesh = fit();
		if (!(mesh instanceof Mesh) || !mesh.parent) throw new Error('Missing joint mesh');
		expect(mesh.parent.children).toEqual([mesh]);
		expect(mesh.parent.visible).toBe(true);

		structures.setJointView(grid, state.year, false);
		structures.step(0, true);
		expect(mesh?.parent?.visible).toBe(false);

		structures.setJointView(grid, state.year, true);
		structures.set('chord', []);
		structures.step(0, true);
		expect(fit()).toBeUndefined();
		structures.set('chord', [chord], undefined, 0);
		structures.step(0, false);
		expect(fit()).toBeUndefined();
		structures.step(1000, false);
		expect(fit()).toBeInstanceOf(Mesh);
		structures.clear();
		expect(fit()).toBeUndefined();
	} finally {
		structures.dispose();
	}
});
