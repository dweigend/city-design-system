import { expect, test } from 'bun:test';
import { positionWorld } from 'three/tsl';
import {
	Color,
	DirectionalLight,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	Raycaster,
	SphereGeometry,
	Vector3
} from 'three/webgpu';
import { overprintColor } from '../../logic/farbe/overprint';
import { linearToOklch, type Rgb } from '../../logic/farbe/oklch';
import { castOffset, halftoneScreen } from './printed-finish';
import { printBatch, printGeometry } from './print-batch';
import type { Primitive } from '../../logic/parametrik/types';
import { collageCut } from './collage-cut';
import { roundedStops } from './station-rings';
import { createLight } from './light';
import { loadStructureModules } from './fixtures/structure-modules';
import { present } from '../../logic/presentation';

import { batch, geometryOf } from '../batch';
import { ceramicBatch } from './ceramic-batch';

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
	const chart = result.geometry.getAttribute('kilnChart');
	expect(chart.count).toBe(result.geometry.getAttribute('position').count);
	const families = Array.from({ length: chart.count }, (_, i) => chart.getW(i));
	expect([...new Set(families)]).toEqual([1, 0, 2]);
	result.geometry.dispose();
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
	light.refresh();
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
	const { geometry } = ceramicBatch([capsule], new Map(), ink);
	const fine = Array.from(geometry.getAttribute('position').array);
	const bounds = (p: number[]) =>
		[0, 1, 2].flatMap((axis) => {
			const values = p.filter((_, i) => i % 3 === axis);
			return [Math.min(...values), Math.max(...values)];
		});
	expect(geometry.index!.count).toBeGreaterThan(coarse.length / 3);
	geometry.dispose();
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

test('overprint divides the linear ink product by the paper channels', () => {
	const paper: Rgb = [0.8, 0.9, 1];
	const a = { token: '--cat-health', rgb: [0.24, 0.56, 0.8] as Rgb };
	const b = { token: '--cat-mobility', rgb: [0.64, 0.45, 0.2] as Rgb };
	const result = overprintColor(a, b, paper);
	expect(result?.[0]).toBeCloseTo(0.192);
	expect(result?.[1]).toBeCloseTo(0.28);
	expect(result?.[2]).toBeCloseTo(0.16);
	expect(overprintColor(b, a, paper)).toEqual(result);
});

test('overprint floors dark pigments in OKLCH and excludes pink in either position', () => {
	const ink = { token: '--cat-health', rgb: [0.01, 0.03, 0.02] as Rgb };
	const paper: Rgb = [0.9, 0.9, 0.9];
	const dark = overprintColor(ink, ink, paper);
	if (!dark) throw Error('Expected a print pigment');
	expect(linearToOklch(dark).l).toBeCloseTo(0.42, 6);
	for (const token of ['--cat-business', '--cat-business-2']) {
		const path = { ...ink, token };
		expect(overprintColor(path, ink, paper)).toBeUndefined();
		expect(overprintColor(ink, path, paper)).toBeUndefined();
	}
});

test('colour faces and ground shadows use the same angle and radius-to-pitch ratio', () => {
	expect(halftoneScreen(true)).toEqual({ angle: Math.PI / 4, pitch: 0.5, radius: 0.18 });
	expect(halftoneScreen(false)).toEqual({ angle: Math.PI / 4, pitch: 1.5, radius: 0.54 });
	expect(castOffset(4)).toBeCloseTo(1.4);
	expect(castOffset(20)).toBe(6);
});

test('overprint patches stay in the existing surface batch without extending its contour', () => {
	const parent: Primitive = {
		...blank,
		kind: 'box',
		position: [0, 0, 0],
		size: [4, 4, 4],
		envelope: true
	};
	const band: Primitive = {
		...blank,
		kind: 'mesh',
		overprint: '--cat-mobility',
		points: [
			[0, 0, 3.5],
			[4, 0, 3.5],
			[4, 0, 4]
		],
		triangles: [0, 1, 2],
		lines: []
	};
	const plain = printGeometry(printBatch([parent], ink).neu);
	const printed = printGeometry(printBatch([band, parent], ink).neu);
	const count = plain.getAttribute('position').count;
	expect(printed.getAttribute('position').count).toBe(count + 3);
	expect(printed.userData.outlineVertices).toBe(count);
	expect(printed.getAttribute('printScreen').getX(count)).toBe(0);
	expect(printed.getAttribute('printOffset').getX(0)).toBeCloseTo(1.4);
	plain.dispose();
	printed.dispose();
});

test('pencil stock uses no face screen or cast shadow while new colour bodies use both', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const finishes = structureMaterials();
	const bearing = new SphereGeometry();
	const body: Primitive = {
		...blank,
		kind: 'box',
		material: 'paper',
		token: '--cat-health',
		position: [0, 0, 0],
		size: [4, 4, 4],
		envelope: true
	};
	const [pencil] = present([{ ...body, finish: 'beton-terrazzo' }], 'pencil');
	const group = populateStructures([body, pencil], finishes, bearing);
	const meshes = group.children.filter((object) => object instanceof Mesh);
	const { stock, stockSheet, solid } = finishes.materials;
	const usesWorldChart = (material: typeof solid) => {
		let found = false;
		material.colorNode?.traverse((node) => {
			if (node === positionWorld) found = true;
		});
		return found;
	};
	try {
		expect(pencil.role).toBe('bestand');
		expect(meshes.find((mesh) => mesh.material === stock)?.castShadow).toBe(false);
		const printed = meshes.find((mesh) => mesh.material === solid);
		expect(printed?.castShadow).toBe(true);
		expect(printed?.geometry.getAttribute('printScreen').getX(0)).toBe(1);
		expect(usesWorldChart(stock)).toBe(false);
		expect(usesWorldChart(stockSheet)).toBe(false);
		expect(usesWorldChart(solid)).toBe(true);
	} finally {
		for (const mesh of meshes) mesh.geometry.dispose();
		finishes.dispose();
		bearing.dispose();
	}
});
