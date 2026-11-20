import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { Color, UniformNode, Vector3 } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { createStudioLight } from '../studio-light';
import { writeAlleyMask } from './alley-mask';
import { createTerrainMesh } from './terrain-mesh';
import { STRUCTURE_PARAMS, TERRAIN_VIEW_PARAMS } from './view-params';
import { plantingSurface } from './planting-surface';
import { forestChunk, LAND_COVER_PARAMS, type Cover } from '../../logic/land-cover';
import { squareGrid } from '../../logic/quad-grid';
import { createTerrain } from '../../logic/terrain';
import { deriveGrid } from '../../logic/terrain-grid';
import { lineParts, routeLine, TRANSIT_PARAMS, vehiclePoses } from '../../logic/transit-line';
import { TREE_PARAMS, trunkRadius } from '../../logic/tree-forms';
import { walkwayParts, WALKWAY_PARAMS } from '../../logic/walkway';
import { resolveParams } from '../../core/params';

const fingerprint = (value: unknown) =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('forest defaults retain the seed-7 geometry, part IDs and order from 9697b48', () => {
	const grid = squareGrid(6, 6, 5, 6);
	const cover: Cover = new Map(grid.cells.map((cell) => [cell.id, 'forest']));
	const planting = forestChunk(grid, cover, '0:0', 7);
	const defaults = planting.map(plantingSurface);
	expect(
		defaults.filter((p) => !p.id.includes(':trunk')).every((p) => p.token === '--cat-foliage')
	).toBe(true);
	const originalInk = defaults.map((p) =>
		p.token === '--cat-foliage' ? { ...p, token: '--cat-nature' } : p
	);
	expect(fingerprint(originalInk)).toBe(
		'b0800045ebdda3d2f1d2357679595d967df505db5a1a31ae687f773b97541799'
	);
	const tree = resolveParams(TREE_PARAMS, { trunkRadiusMin: 0.5 });
	const overrides = resolveParams(LAND_COVER_PARAMS, { cellMargin: 0.5 });
	const changed = forestChunk(grid, cover, '0:0', 7, overrides, tree).map(plantingSurface);
	expect(changed.map((p) => p.id)).toEqual(defaults.map((p) => p.id));
	expect(changed[0]).toMatchObject({ radius: trunkRadius(3, tree) });
	expect(changed).not.toEqual(defaults);
});

const grid = deriveGrid(createTerrain({ seed: 7 }));
const terrainRoutes = {
	viaduct: '4dfa2e37ade7eac468c402b861c5eae5727fa499ace97e125bacb8c0240e4ed5',
	capsule: '42748c2bb65a139d2ec40c947b70dc5b468c478339cd3412548f626aba16983d'
};
const kinds = ['viaduct', 'capsule'] as const;
for (const kind of kinds) {
	test(kind + ' retains the default output and projects serialized overrides', () => {
		const stroke = { id: 'test', kind, cellIds: ['40/35', '80/35', '80/75'] };
		const line = routeLine(grid, stroke);
		if (!line) throw new Error('Expected the default route');
		// The I reference pins route geometry; O adds independent drafting metadata.
		const geometry = lineParts(line).map((part) => {
			const copy = { ...part };
			if (copy.kind === 'pipe') {
				expect(copy.sampled).toBe(true);
				delete copy.sampled;
			}
			delete copy.member;
			delete copy.bearings;
			return copy;
		});
		expect(fingerprint([line.path, geometry, vehiclePoses(line, 10)])).toBe(terrainRoutes[kind]);
		// Defaults written out give the same route as no overrides: independent of the terrain.
		const defaults = Object.fromEntries(
			Object.entries(TRANSIT_PARAMS[kind]).map(([name, param]) => [name, param.default])
		);
		const explicit = routeLine(grid, stroke, defaults);
		if (!explicit) throw new Error('Expected the explicit default route');
		expect([explicit.path, lineParts(explicit), vehiclePoses(explicit, 10)]).toEqual([
			line.path,
			lineParts(line),
			vehiclePoses(line, 10)
		]);
		const radius = TRANSIT_PARAMS[kind].deckRadius.default + 0.1;
		const changed = routeLine(grid, stroke, { deckRadius: radius, speed: 8 });
		if (!changed) throw new Error('Expected the customized route');
		expect(changed.profile).toEqual({ deckRadius: radius, speed: 8 });
		expect(lineParts(JSON.parse(JSON.stringify(changed)))[0]).toMatchObject({ radius });
		expect(changed.path).toEqual(line.path);
		expect(changed.pillars[0].top).toBeCloseTo(line.pillars[0].top - 0.1);
		expect(vehiclePoses(changed, 10)).not.toEqual(vehiclePoses(line, 10));
	});
}

test('walkway defaults retain the bent route and its thickness follows the profile', () => {
	const points = [
		[0, 0, 6],
		[12, 0, 4],
		[12, 12, 4]
	] as const;
	const anchors = points.map(([x, y, z]): [number, number, number] => [x, y, z]);
	const defaults = walkwayParts(anchors);
	const guards = defaults.filter((p) => p.kind === 'polyline');
	expect(guards.map((p) => p.points.map((q) => q[2]))).toEqual([
		[7, 5, 5],
		[7, 5, 5]
	]);
	expect(defaults.filter((p) => p.kind === 'cylinder')).toHaveLength(2);
	expect(defaults.some((part) => part.kind === 'prism' && part.bearing === 'slab')).toBe(true);
	const overrides = resolveParams(WALKWAY_PARAMS, { thickness: 0.5, treadRise: 0.5 });
	const parts = walkwayParts(anchors, undefined, overrides);
	expect(parts.filter((p) => p.id.includes(':tread:'))).toHaveLength(5);
	expect(parts[0]).toMatchObject({ height: 0.5, z: 5.5 });
	expect(parts.find((p) => p.id === 'walkway:0:pier')).toMatchObject({ height: 4.5 });
});

test('sandbox projection exposes cell units and validates material overrides', () => {
	expect(TERRAIN_VIEW_PARAMS.parcelCells).toMatchObject({
		type: 'integer',
		unit: 'cells',
		default: 10
	});
	expect(() => resolveParams(TERRAIN_VIEW_PARAMS, { parcelCells: 2.5 })).toThrow(RangeError);
	expect(() => resolveParams(STRUCTURE_PARAMS, { glassOpacity: 2 })).toThrow(RangeError);
});

test('terrain parameters update numeric uniforms on the existing surface shader', () => {
	const terrain = createTerrainMesh(grid);
	try {
		const shader = terrain.surface.material.colorNode;
		const uniforms = new Set<UniformNode<unknown>>();
		shader?.traverse((node) => {
			if (node instanceof UniformNode) uniforms.add(node);
		});
		const values = () => [...uniforms].map((uniform) => uniform.value);
		const defaults = values();
		terrain.setParams({
			parcelCells: 23,
			lensCells: 17,
			planContourGain: 0.63,
			embossInk: 0.31,
			embossWidth: 0.7
		});
		expect(values()).toEqual(expect.arrayContaining([23, 17, 17 * 0.35, 0.63, 0.31, 0.7]));
		expect(terrain.surface.material.colorNode).toBe(shader);
		expect(() => terrain.setParams({ parcelCells: 2.5 })).toThrow(RangeError);
		terrain.setParams();
		expect(values()).toEqual(defaults);
	} finally {
		terrain.dispose();
	}
});

test('removing the last nearby house clears only its local stair ink', () => {
	const stairs = grid.cells.filter((c) => c.plan.stairAlley);
	const first = stairs[0],
		last = stairs[stairs.length - 1];
	const pixels = new Uint8Array(grid.cells.length * 4);
	const ink = (i: number) => pixels[i * 4 + 2] & 128;
	writeAlleyMask(pixels, grid, [first.id, last.id], 1);
	expect(ink(first.index)).toBe(128);
	expect(ink(last.index)).toBe(128);
	writeAlleyMask(pixels, grid, [last.id], 1);
	expect(ink(first.index)).toBe(0);
	expect(ink(last.index)).toBe(128);
	writeAlleyMask(pixels, grid, [], 1);
	expect(stairs.every((c) => ink(c.index) === 0)).toBe(true);
});

test('night shadows cannot brighten the paper while daytime keeps the shared warm-grey shadow', () => {
	const light = createStudioLight();
	const readTone = () => {
		let tone: Vector3 | undefined;
		light.shade(vec3(1)).traverse((node) => {
			if (node instanceof UniformNode && node.value instanceof Vector3) tone = node.value;
		});
		return tone?.toArray();
	};
	try {
		const studioTone = readTone();
		light.setPaper(new Color(0.96, 0.96, 0.96));
		expect(readTone()).toEqual(studioTone);
		light.setPaper(new Color(0.006, 0.007, 0.008));
		expect(readTone()).toEqual([0.006, 0.007, 0.008]);
	} finally {
		light.dispose();
	}
});

test('the terrain shader switches off the wash only for the dark palette', () => {
	const terrain = createTerrainMesh(grid);
	const palette = {
		ink: '#181a20',
		paper: '#faf9f6',
		blueprint: '#4470a5',
		blueprintSoft: '#7796cc',
		categories: { health: '#497dbe', nature: '#378654', mobility: '#e9bf55', business: '#d46898' }
	};
	const uniforms = new Set<{ value: number }>();
	terrain.surface.material.colorNode?.traverse((node) => {
		if (node instanceof UniformNode && typeof node.value === 'number') uniforms.add(node);
	});
	try {
		terrain.setPalette(palette);
		const daytime = [...uniforms].map(({ value }) => value);
		terrain.setPalette({ ...palette, paper: '#101215', ink: '#f1efe9' });
		const night = [...uniforms].map(({ value }) => value);
		expect(
			night.flatMap((value, i) => (value === daytime[i] ? [] : [[daytime[i], value]]))
		).toEqual([[1, 0]]);
		terrain.setPalette(palette);
		expect([...uniforms].map(({ value }) => value)).toEqual(daytime);
	} finally {
		terrain.dispose();
	}
});

test('river chart and wakes agree on shared survey vertices, including across bends', async () => {
	const { waterGeometry } = await import('./terrain-geometry');
	const cell = grid.cells.find((c) => c.zone === 'water');
	if (!cell) throw Error('Expected water on the seed-7 survey');
	const [x, y] = cell.center;
	const water = waterGeometry(grid, [[x - 1, y + 1]]);
	const position = water.getAttribute('position'),
		chart = water.getAttribute('chart'),
		wake = water.getAttribute('wake');
	const seen = new Map<string, string>();
	let repeated = 0,
		cracks = 0;
	for (let i = 0; i < position.count; i++) {
		const vertex = position.getX(i) + '/' + position.getZ(i);
		const sample = [chart.getX(i), chart.getY(i), wake.getX(i)].join('/');
		if (seen.has(vertex)) {
			repeated++;
			if (sample !== seen.get(vertex)) cracks++;
		}
		seen.set(vertex, sample);
	}
	expect(repeated).toBeGreaterThan(0);
	expect(cracks).toBe(0);
	water.dispose();
});

test('water shares terrain transparency, hides with the terrain and restores its depth policy', async () => {
	const { focuses } = await import('../../logic/presentation');
	const terrain = createTerrainMesh(grid);
	try {
		for (const level of [
			'full',
			'transparent',
			'silhouette',
			'pencil',
			'hidden',
			'full'
		] as const) {
			terrain.setPresentation({ ...focuses.all, terrain: level }, false);
			expect(terrain.group.visible).toBe(level !== 'hidden');
			for (const material of [terrain.water.material, terrain.surface.material]) {
				expect(material.opacity).toBe(level === 'transparent' ? 0.14 : 1);
				expect(material.transparent).toBe(level === 'transparent');
				expect(material.depthWrite).toBe(level !== 'transparent');
			}
		}
	} finally {
		terrain.dispose();
	}
});
