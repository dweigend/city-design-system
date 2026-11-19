// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import {
	Color,
	DirectionalLight,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	Raycaster,
	Vector3
} from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { collageCut } from './collage-cut';
import { roundedStops } from './station-rings';
import { createLight } from './light';

// The generic scene batch imports the Svelte theme outside the compiled client.
const shim = !('$state' in globalThis);
if (shim)
	Object.defineProperty(globalThis, '$state', { configurable: true, value: (v: unknown) => v });
const [{ batch, geometryOf }, { ceramicBatch }] = await Promise.all([
	import('../batch'),
	import('./ceramic-batch')
]).finally(() => {
	if (shim) Reflect.deleteProperty(globalThis, '$state');
});

const blank = { id: 'socket', role: 'neu', material: 'glaze', token: '--paper' } as const;
const capsule: Primitive = { ...blank, kind: 'capsule', from: [0, 0, 2], to: [3, 0, 2], radius: 1 };
const ink = () => new Color(1, 1, 1);

test('the fitting gives only its own casting a dip coordinate and the plain neighbour stays clay', () => {
	const blue: Primitive = {
		...blank,
		id: 'socket/fitting',
		token: '--cat-health',
		kind: 'sphere',
		radius: 1,
		position: [3, 0, 4]
	};
	const result = ceramicBatch(
		[capsule, { ...capsule, id: 'other' }, blue],
		new Map([['socket', blue]]),
		ink
	);
	expect(result.chart.count).toBe(result.faces.p.length / 3);
	const families = Array.from({ length: result.chart.count }, (_, i) => result.chart.getW(i));
	expect([...new Set(families)]).toEqual([1, 0, 2]);
});

test('a picking ray passes through the cut and hits the shoulder on both footprint windings', () => {
	for (const sign of [-1, 1]) {
		const p: Primitive = {
			...blank,
			kind: 'prism',
			material: 'paper',
			envelope: true,
			glass: true,
			z: 0,
			height: 4,
			polygon: [
				[0, 0],
				[4, 0],
				[4, sign * 2],
				[0, sign * 2]
			]
		};
		const shape = collageCut(p);
		const mesh = new Mesh(geometryOf(batch([shape], ink).neu), new MeshBasicMaterial());
		const cast = (x: number) =>
			new Raycaster(new Vector3(x, 1, 8), new Vector3(0, 0, -1)).intersectObject(mesh);
		expect(cast(2)).toHaveLength(0);
		expect(cast(0.2)[0]?.point.z).toBeCloseTo(sign === 1 ? 0 : 2);
		mesh.geometry.dispose();
		mesh.material.dispose();
		expect(collageCut({ ...p, role: 'bestand' })).toMatchObject({ kind: 'prism' });
	}
});

test('both stop families have a physical aperture centred on the surveyed platform', () => {
	const [station, chamber] = roundedStops([
		{ ...blank, id: 'r/stop/0', kind: 'cylinder', radius: 4, height: 0.4, position: [0, 0, 5] },
		{ ...blank, id: 'r/stop/1', kind: 'sphere', radius: 3, position: [20, 0, 6] }
	]);
	for (const p of [station, chamber]) {
		expect(p.kind).toBe('torus');
		if (p.kind !== 'torus') throw Error('Expected open platform');
		const mesh = new Mesh(
			geometryOf(batch([p], ink).neu),
			new MeshBasicMaterial({ side: DoubleSide })
		);
		expect(
			new Raycaster(new Vector3(p.position[0], 20, 0), new Vector3(0, -1, 0)).intersectObject(mesh)
		).toHaveLength(0);
		mesh.geometry.dispose();
		mesh.material.dispose();
	}
});

test('a water-only tick reuses the shadow map while panning or changing casters invalidates it', () => {
	const light = createLight(),
		sun = light.objects[0];
	if (!(sun instanceof DirectionalLight)) throw Error('Expected sun');
	const target = new Vector3(2, 1, 3);
	light.aim(target, 150);
	sun.shadow.needsUpdate = false;
	light.aim(target, 150);
	expect(sun.shadow.needsUpdate).toBe(false);
	light.aim(target.clone().addScalar(1), 150);
	expect(sun.shadow.needsUpdate).toBe(true);
	sun.shadow.needsUpdate = false;
	light.invalidate();
	expect(sun.shadow.needsUpdate).toBe(true);
	light.dispose();
});

test('rail dashes follow chainage around a bend for the viaduct and the capsule tube', async () => {
	const { conduitBatch } = await import('./print-flow');
	for (const glass of [false, true]) {
		const pipe: Primitive = {
			...blank,
			kind: 'pipe',
			points: [
				[0, 0, 2],
				[10, 0, 2],
				[10, 10, 2]
			],
			radius: 0.2,
			glass
		};
		const { axis, faces } = conduitBatch([pipe], ink);
		expect(axis.count).toBe(faces.p.length / 3);
		expect(Math.min(...axis.array)).toBeCloseTo(0);
		expect(Math.max(...axis.array)).toBeCloseTo(20);
	}
});

test('fine casting tessellation preserves both cap seats and the outer radius', () => {
	const coarse = batch([capsule], ink).neu.p;
	const fine = ceramicBatch([capsule], new Map(), ink).faces.p;
	const bounds = (p: number[]) =>
		[0, 1, 2].flatMap((axis) => {
			const values = p.filter((_, i) => i % 3 === axis);
			return [Math.min(...values), Math.max(...values)];
		});
	expect(fine.length).toBeGreaterThan(coarse.length);
	bounds(fine).forEach((v, i) => expect(v).toBeCloseTo(bounds(coarse)[i], 5));
});

test('pencil window bars follow a rotated stock opening and do not add ink to new construction', async () => {
	const { stockDetail } = await import('./stock-detail');
	const panel: Primitive = {
		...blank,
		role: 'bestand',
		id: 'bay:opening0',
		kind: 'box',
		position: [0, 0, 3],
		size: [3, 0.2, 1],
		rotation: Math.PI / 2
	};
	const segments = stockDetail([panel]);
	expect(segments.length).toBeGreaterThan(0);
	expect(segments.filter((_, i) => i % 3 === 1).every((z) => z >= 3 && z <= 4)).toBe(true);
	expect(stockDetail([{ ...panel, role: 'neu' }])).toEqual([]);
});
