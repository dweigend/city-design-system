import { expect, test } from 'bun:test';
import { Group, Matrix4, Mesh, Raycaster, Vector3 } from 'three/webgpu';
import { focuses, present } from '../../logic/presentation';
import type { Primitive } from '../../logic/parametrik/types';
import { sandboxStyle } from './drafting-style';
import { distanceDrawing } from './distance-drawing';
import { houseDistricts } from './house-districts';
import { createStructures } from './structures';
import { partition } from './structure-layers';
import { createWorld, applyEdit, currentStacks, houseView } from '../../logic/sandbox';

function pair(i: number): Primitive[] {
	const x = i % 16,
		y = Math.floor(i / 16);
	return [
		{
			id: i + ':wall',
			role: 'neu',
			material: 'concrete',
			token: '--paper',
			kind: 'box',
			position: [x, y, 0],
			size: [0.25, 0.25, 1]
		},
		{
			id: i + ':fruit0',
			role: 'neu',
			material: 'paper',
			token: '--cat-nature',
			kind: 'sphere',
			position: [x, y, 2],
			radius: 0.1
		}
	];
}

test('within a visible district the draw and motion counts are independent of the number of masses', () => {
	for (const zoom of ['nah', 'stadt'] as const) {
		const style = sandboxStyle({ zoom, modus: 'ansehen', situation: 'normal' }, 'leitstil');
		const counts = [1, 32, 128].map((size) => {
			const layer = createStructures(),
				districts = houseDistricts();
			try {
				layer.setStyle([style, 'leitstil', zoom === 'nah' ? 40 : 2.5], Math.PI / 4);
				for (let i = 0; i < size; i++) districts.set('2:3', 'mass-' + i, pair(i));
				districts.flush((chunk, parts) => layer.queue('house:' + chunk, parts));
				layer.setStyle([style, 'leitstil', zoom === 'nah' ? 40 : 2.5], Math.PI / 4);
				let meshes = 0,
					transforms = 0;
				layer.group.traverse((o) => {
					if (o instanceof Mesh) meshes++;
					if (!(o instanceof Group)) return;
					const original = o.updateMatrix.bind(o);
					o.updateMatrix = () => {
						transforms++;
						original();
					};
				});
				layer.step(5000, false);
				expect(meshes).toBeGreaterThan(0);
				expect(transforms).toBe(zoom === 'nah' ? 1 : 0);
				return meshes;
			} finally {
				layer.dispose();
			}
		});
		expect(new Set(counts).size).toBe(1);
	}
});

test('the moving and vacated crown edges pick the same geometry as the screen, including after seek', () => {
	const layer = createStructures();
	try {
		layer.set('installation:probe', pair(0), '0/0');
		const targets = layer.solids('installation:probe');
		const [wall, crown] = targets;
		if (!(crown instanceof Mesh)) throw Error('missing crown mesh');
		let visible: Mesh | undefined;
		layer.group.traverse((o) => {
			if (o instanceof Mesh && o.geometry === crown.geometry && o.material === crown.material)
				visible = o;
		});
		if (!visible) throw Error('missing fruit');
		const ray = new Raycaster();
		const hits = (x: number, z: number, target: typeof crown) => {
			ray.set(new Vector3(x, 5, z), new Vector3(0, -1, 0));
			return ray.intersectObject(target, false).length > 0;
		};
		const seated = crown.clone(false);
		seated.matrixWorld.identity();
		let first: number[] = [];
		for (const t of [5000, 6000, 5000]) {
			layer.step(t, false);
			layer.group.updateMatrixWorld(true);
			expect(wall.matrixWorld.equals(new Matrix4())).toBe(true);
			expect(crown.matrixWorld.equals(visible.matrixWorld)).toBe(true);
			let entered = false,
				vacated = false;
			for (let mm = -160; mm <= 160; mm += 2) {
				const x = mm / 1000;
				const now = hits(x, 0, visible);
				const before = hits(x, 0, seated);
				expect(hits(x, 0, crown)).toBe(now);
				entered ||= now && !before;
				vacated ||= before && !now;
			}
			expect(entered && vacated).toBe(true);
			expect(crown.userData.cellId).toBe('0/0');
			if (t === 5000 && first.length) expect(crown.matrixWorld.elements).toEqual(first);
			if (!first.length) first = [...crown.matrixWorld.elements];
		}
	} finally {
		layer.dispose();
	}
});

test('living stairs retain people pink and service colours stay on their own parts', () => {
	for (const use of ['living', 'water'] as const) {
		const id = '86/43';
		const world = applyEdit(createWorld(7), { kind: 'raise', style: 'collage', use, cellId: id });
		const parts = houseView(
			world,
			currentStacks(world.state),
			world.grid.cellsById.get(id)!.chunk,
			focuses.all
		);
		for (const [level, coarse] of [
			['full', false],
			['silhouette', false],
			['full', true]
		] as const) {
			const drawing = distanceDrawing(present(parts, level), {
				scale: coarse ? 2.5 : 40,
				elevation: Math.PI / 4,
				block: coarse,
				minContourPx: 0.5
			});
			const layers = partition(drawing.parts, drawing.unoutlined);
			const rendered = Object.values(layers).flat();
			const stock = rendered.filter((p) => p.id === id + '@3:stock');
			expect(stock.length).toBeGreaterThan(0);
			expect(stock.every((p) => p.token === '--paper')).toBe(true);
			if (use === 'water')
				expect(rendered.some((p) => p.id.includes(':figure') && p.token === '--cat-health')).toBe(
					true
				);
			if (use === 'living')
				expect(
					rendered.filter(
						(p) => p.id.startsWith(id + '@3:figure:step') && p.token === '--cat-business'
					)
				).toHaveLength(coarse ? 1 : 8);
		}
	}
});

test('the docked casting and its pick surface share a pose after the placement drop', () => {
	const layer = createStructures();
	const capsule: Primitive = {
		id: 'module',
		role: 'neu',
		token: '--paper',
		material: 'glaze',
		kind: 'capsule',
		from: [1, 0, 2],
		to: [4, 0, 2],
		radius: 0.75
	};
	try {
		layer.set('installation:dock', [capsule], '4/5', 0);
		const [target] = layer.solids('installation:dock');
		if (!(target instanceof Mesh)) throw Error('missing casting pick surface');
		const face = layer.group.getObjectByProperty('geometry', target.geometry);
		if (!(face instanceof Mesh)) throw Error('missing casting');
		for (const seconds of [0.2, 2, 0.2]) {
			layer.step(seconds * 1000, false);
			layer.group.updateMatrixWorld(true);
			expect(target.matrixWorld.elements).toEqual(face.matrixWorld.elements);
			expect(target.matrixWorld.equals(new Matrix4())).toBe(seconds === 2);
			const ray = new Raycaster(new Vector3(2, 6, 0), new Vector3(0, -1, 0));
			const [visible] = ray.intersectObject(face, false);
			const [picked] = ray.intersectObject(target, false);
			expect(picked.distance).toBe(visible.distance);
			expect(picked.object.userData.cellId).toBe('4/5');
		}
	} finally {
		layer.dispose();
	}
});
