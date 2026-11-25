import { expect, test } from 'bun:test';
import { specimenSettings as settings } from '../../config/surface-specimens';
import { crossProduct, displacement, length, type Vec3 } from '../../lib/core/geometry';
import * as material from '../../lib/domain/material';
import { createSampleBoard } from './board';
import { createSampleBody } from './body';
import { groundFamily, readControl, readSpecimen } from './controls';

test('the module query underflow clamps to the slider minimum before building', () => {
	const query = new URL('/surfaces?module=5e-324&seed=-1', 'http://localhost').searchParams;
	expect(readControl(query.get('module'), settings.moduleScaleBand)).toBe(
		settings.moduleScaleBand[0]
	);
	expect(readControl(query.get('seed'), settings.seedBand)).toBe(settings.seedBand[0]);
});

test.each([
	['', 'body'],
	['body=stripe', 'body'],
	['show=stripe', 'board'],
	['levels=near,mid', 'board'],
	['zoom=1.5', 'board'],
	['specimen=body&zoom=1.5', 'body'],
	['specimen=body&show=stripe&levels=near,mid', 'body'],
	['specimen=board&body=stripe', 'board']
] as const)('capture query %s opens the %s specimen', (query, specimen) => {
	expect(readSpecimen(new URLSearchParams(query))).toBe(specimen);
});

const wallFamilies = material.familyNames.filter((name) => name !== groundFamily);

test('the plates keep their families, per-plate levels, stands and budgets', () => {
	const entries = material.familyNames.map((family) => ({ family, level: 'near' as const }));
	const board = createSampleBoard([...entries, { family: 'stripe', level: 'pencil' }], {
		moduleScale: settings.moduleScaleBand[0],
		level: 'plain'
	});
	expect(board.surfaces.map(({ family }) => family)).toEqual([...material.familyNames, 'stripe']);
	expect(board.surfaces.at(-1)?.level).toBe('pencil');
	expect(board.surfaces[0].level).toBe('near');
	expect(board.object.parts.filter(({ slot }) => slot === 'stand')).toHaveLength(
		board.surfaces.length
	);
	expect(board.triangles).toBe(
		board.surfaces.reduce((count, surface) => count + surface.triangles, 0)
	);
	for (const surface of board.surfaces)
		expect(surface.triangles).toBeLessThanOrEqual(settings.plateTriangleBudget);
});

test.each(wallFamilies)(
	'the %s library stays within budget at every level and slider step',
	(family) => {
		const [min, max, step] = settings.moduleScaleBand;
		for (const level of material.surfaceLevels) {
			for (let moduleScale = min; moduleScale <= max; moduleScale += step) {
				const body = createSampleBody(family, { level, moduleScale });
				expect(body.triangles).toBeLessThanOrEqual(settings.bodyTriangleBudget);
				expect(body.triangles).toBe(
					body.surfaces.reduce((count, surface) => count + surface.triangles, 0)
				);
				const walls = body.surfaces.slice(0, 8);
				expect(walls.every(({ meshes }) => meshes.has('face'))).toBe(true);
				expect(new Set(walls.map((wall) => wall.moduleScale)).size).toBe(1);
			}
		}
	}
);

test('specimens, controls and presentation adapters are outside the material entry', () => {
	for (const name of [
		'createSampleBoard',
		'createSampleBody',
		'triangleBudgets',
		'surfaceControls',
		'readLight',
		'readSurfaceLevel'
	])
		expect(Object.hasOwn(material, name)).toBe(false);
	for (const family of material.familyNames)
		expect(Object.hasOwn(material.readFamily(family), 'ground')).toBe(false);
});

type Mesh = NonNullable<ReturnType<material.SurfaceMesh['meshes']['get']>>;

function vertex(positions: readonly number[], index: number): Vec3 {
	const at = index * 3;
	return [positions[at], positions[at + 1], positions[at + 2]];
}

function vertices({ positions }: { positions: readonly number[] }): Vec3[] {
	return Array.from({ length: positions.length / 3 }, (_, i) => vertex(positions, i));
}

function face({ meshes }: material.SurfaceMesh): Mesh {
	const mesh = meshes.get('face');
	if (!mesh) throw new Error('Expected a solid cladding face');
	return mesh;
}

test('the library has flat slabs, a cantilever and recessed lights only in detailed views', () => {
	const near = createSampleBody('board');
	const roof = near.object.parts.find(({ id }) => id === 'roof/face')?.shape;
	if (roof?.kind !== 'mesh') throw new Error('Expected a roof mesh');
	const roofPoints = vertices(roof);
	const planes = new Set(roofPoints.map(([, , z]) => z.toFixed(6)));
	expect(planes.size).toBe(5); // The bar roof and reading room floor touch.
	for (let i = 0; i < roof.indices.length; i += 3) {
		const [a, b, c] = roof.indices.slice(i, i + 3).map((index) => vertex(roof.positions, index));
		const normal = crossProduct(displacement(a, b), displacement(a, c));
		expect(normal.filter((component) => Math.abs(component) > 1e-6)).toHaveLength(1);
	}
	const lowerEnd = Math.max(...vertices(face(near.surfaces[1])).map(([x]) => x));
	const upperEnd = Math.max(...vertices(face(near.surfaces[5])).map(([x]) => x));
	expect(upperEnd).toBeGreaterThan(lowerEnd);

	const openings = near.surfaces.slice(8, -4);
	expect(openings.map(({ family }) => family)).toEqual(Array(4).fill('acrylic'));
	const frontWallY = Math.min(...vertices(face(near.surfaces[0])).map(([, y]) => y));
	expect(Math.min(...vertices(face(openings[0])).map(([, y]) => y))).toBeCloseTo(
		frontWallY + settings.bodyOpeningInsetM
	);
	expect(createSampleBody('board', { level: 'far' }).groups.map(({ id }) => id)).toEqual([
		'wall',
		'roof',
		'ground'
	]);
});

test('each library panel is a closed, consistently wound patch, including its opening reveals', () => {
	const { surfaces } = createSampleBody('board');
	for (const surface of surfaces) {
		const { positions, indices } = face(surface);
		const uses = new Map<string, number>();
		for (let i = 0; i < indices.length; i += 3) {
			const points = indices.slice(i, i + 3).map((index) => vertex(positions, index));
			const [a, b, c] = points;
			expect(length(crossProduct(displacement(a, b), displacement(a, c)))).toBeGreaterThan(1e-6);
			const keys = points.map((point) => point.map((value) => Math.round(value * 1e6)).join(','));
			for (const [j, from] of keys.entries()) {
				const to = keys[(j + 1) % keys.length];
				const edge = from + '/' + to;
				uses.set(edge, (uses.get(edge) ?? 0) + 1);
			}
		}
		for (const [edge, count] of uses) {
			const [from, to] = edge.split('/');
			expect(count).toBe(1);
			expect(uses.get(to + '/' + from)).toBe(1);
		}
	}
});

function printedEdges(surface: material.SurfaceMesh, axis: 0 | 1) {
	const mark = surface.meshes.get('mark');
	if (!mark) throw new Error('Expected printed marks');
	return [...new Set(vertices(mark).map((point) => Math.round(point[axis] * 1e6) / 1e6))].sort(
		(a, b) => a - b
	);
}

test('stripe bands clear every corner and keep their phase across the step', () => {
	const near = createSampleBody('stripe');
	for (const [i, wall] of near.surfaces.slice(0, 8).entries()) {
		const axis = i % 2 === 0 ? 0 : 1;
		const along = vertices(face(wall)).map((point) => point[axis]);
		const bands = printedEdges(wall, axis);
		expect(bands[0] - Math.min(...along)).toBeCloseTo(0.15);
		expect(Math.max(...along) - (bands.at(-1) ?? 0)).toBeCloseTo(0.15);
	}
	// An off-grid pitch distinguishes a shared frame from separate frames centered on each mass.
	const offGrid = createSampleBody('stripe', { moduleScale: 1.25 });
	const upperNorth = vertices(face(offGrid.surfaces[6])).map(([x]) => x);
	const [left, right] = [Math.min(...upperNorth), settings.bodyBarM[0] / 2];
	const common = (surface: material.SurfaceMesh) =>
		printedEdges(surface, 0).filter((x) => x > left && x < right);
	const lowerBands = common(offGrid.surfaces[2]);
	expect(lowerBands.length).toBeGreaterThan(4);
	expect(common(offGrid.surfaces[6])).toEqual(lowerBands);
});
