import { expect, test } from 'bun:test';
import type { Vec3 } from '../../core/geometry';
import { materialSettings } from '../../../config/material';
import { cladExample } from './example';
import {
	buildSurface,
	createClad,
	createPatternFrame,
	familyNames,
	readFamily,
	surfaceLevels,
	type Patch
} from './index';

const sqrt = Math.SQRT1_2;
const orientations: readonly Readonly<{ across: Vec3; normal: Vec3 }>[] = [
	{ across: [1, 0, 0], normal: [0, -1, 0] },
	{ across: [0, 1, 0], normal: [1, 0, 0] },
	{ across: [1, 0, 0], normal: [0, 0, 1] },
	{ across: [sqrt, sqrt, 0], normal: [0.6 * sqrt, -0.6 * sqrt, 0.8] }
];
const sizes = [
	[0.7, 0.45],
	[2, 2],
	[5.3, 3.1]
] as const;

function local(point: Vec3, { origin, across, normal }: Patch) {
	const d = [0, 1, 2].map((i) => point[i] - origin[i]);
	const up = [
		normal[1] * across[2] - normal[2] * across[1],
		normal[2] * across[0] - normal[0] * across[2],
		normal[0] * across[1] - normal[1] * across[0]
	];
	const dot = (axis: readonly number[]) => d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
	return [dot(across), dot(up), dot(normal)];
}

function points(positions: readonly number[]): Vec3[] {
	return Array.from({ length: positions.length / 3 }, (_, i) => [
		positions[3 * i],
		positions[3 * i + 1],
		positions[3 * i + 2]
	]);
}

test('every family builds at every level on arbitrary planar patches inside the patch box', () => {
	for (const family of familyNames)
		for (const level of surfaceLevels)
			for (const { across, normal } of orientations)
				for (const size of sizes) {
					const patch: Patch = {
						origin: [3, -2, 1],
						across,
						normal,
						size,
						thickness: 0.1,
						openings: [[0.2, 0.1, 0.4, 0.3]],
						budget: 20000
					};
					const mesh = buildSurface(family, patch, { level });
					expect(mesh.triangles).toBeGreaterThan(0);
					for (const [slot, { positions, indices }] of mesh.meshes) {
						expect(readFamily(family).slots).toContain(slot);
						expect(indices.length % 3).toBe(0);
						for (const point of points(positions)) {
							const [u, v, w] = local(point, patch);
							expect(u).toBeGreaterThanOrEqual(-1e-6);
							expect(u).toBeLessThanOrEqual(size[0] + 1e-6);
							expect(v).toBeGreaterThanOrEqual(-1e-6);
							expect(v).toBeLessThanOrEqual(size[1] + 1e-6);
							expect(w).toBeGreaterThanOrEqual(-patch.thickness - 1e-6);
							expect(w).toBeLessThanOrEqual(materialSettings.markLiftM + 1e-6);
						}
					}
				}
});

test('faces wind outward and nothing is drawn inside an opening the level shows', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [3, 2],
		thickness: 0.2,
		openings: [[1, 0.5, 2, 1.5]]
	};
	for (const family of familyNames)
		for (const level of ['near', 'mid', 'pencil'] as const) {
			const mesh = buildSurface(family, patch, { level });
			for (const [slot, { positions, indices }] of mesh.meshes)
				for (let i = 0; i < indices.length; i += 3) {
					const [a, b, c] = [0, 1, 2].map((k) => local(points(positions)[indices[i + k]], patch));
					const facing = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
					if (Math.min(a[2], b[2], c[2]) >= -1e-9) expect(facing).toBeGreaterThanOrEqual(-1e-9);
					const [u, v] = [0, 1].map((k) => (a[k] + b[k] + c[k]) / 3);
					const inside = u > 1 + 1e-6 && u < 2 - 1e-6 && v > 0.5 + 1e-6 && v < 1.5 - 1e-6;
					expect({ family, level, slot, inside }).toEqual({ family, level, slot, inside: false });
				}
		}
});

test('stripes wrap a body: the stripe phase matches where wall and roof share an edge', () => {
	const { surfaces, object } = cladExample();
	expect(JSON.stringify(object)).not.toMatch(/--|#[0-9a-f]{3}|rgb|oklch|color/i);
	// Dark intervals of x along the shared eaves edge, merged, from triangles with a side on it.
	const darkAlong = (
		mesh: { positions: number[]; indices: number[] } | undefined,
		onEdge: (p: Vec3) => boolean
	) => {
		const list = points(mesh?.positions ?? []);
		const spans: [number, number][] = [];
		for (let i = 0; i < (mesh?.indices.length ?? 0); i += 3) {
			const xs = (mesh?.indices.slice(i, i + 3) ?? [])
				.map((k) => list[k])
				.filter(onEdge)
				.map(([x]) => x);
			if (xs.length >= 2) spans.push([Math.min(...xs), Math.max(...xs)]);
		}
		spans.sort((p, q) => p[0] - q[0]);
		const merged: [number, number][] = [];
		for (const [from, to] of spans) {
			const last = merged.at(-1);
			if (last && from <= last[1] + 1e-9) last[1] = Math.max(last[1], to);
			else merged.push([from, to]);
		}
		return merged.map(([from, to]) => [Math.round(from * 1e6) / 1e6, Math.round(to * 1e6) / 1e6]);
	};
	const [wall, roof] = surfaces.map((surface) => surface.meshes.get('mark'));
	const wallTop = darkAlong(wall, ([, y, z]) => Math.abs(z - 2) < 1e-6 && y < 0);
	const roofFront = darkAlong(roof, ([, y, z]) => Math.abs(y) < 1e-6 && z > 2);
	expect(wallTop.length).toBeGreaterThan(2);
	expect(roofFront).toEqual(wallTop);
});

test('a dot grid continues round a corner of its body', () => {
	const south: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [3, 2],
		thickness: 0.05
	};
	const east: Patch = {
		...south,
		origin: [3, 0, 0],
		across: [0, 1, 0],
		normal: [1, 0, 0],
		size: [2, 2]
	};
	const clad = createClad(
		{ id: 'cube', footprint: { width: 3, depth: 2 }, anchors: [] },
		[south, east].map((patch) => ({
			role: 'wall',
			family: 'perforated' as const,
			body: 'cube',
			patch
		}))
	);
	const centres = (positions: readonly number[]) => {
		const list = points(positions);
		const sides = materialSettings.dotSides;
		return Array.from({ length: list.length / sides }, (_, i) =>
			list
				.slice(i * sides, (i + 1) * sides)
				.reduce<Vec3>(
					(sum, [x, y, z]) => [sum[0] + x / sides, sum[1] + y / sides, sum[2] + z / sides],
					[0, 0, 0]
				)
		);
	};
	const [a, b] = clad.surfaces.map((surface) =>
		centres(surface.meshes.get('mark')?.positions ?? [])
	);
	const pitch = (extent: number) =>
		extent / Math.round(extent / materialSettings.perforationPitchM);
	// The corner is a period boundary on both faces: the nearest column sits half a period away.
	expect(Math.min(...a.map(([x]) => 3 - x))).toBeCloseTo(pitch(3) / 2, 6);
	expect(Math.min(...b.map(([, y]) => y))).toBeCloseTo(pitch(2) / 2, 6);
	const rows = (list: Vec3[]) => [...new Set(list.map(([, , z]) => Math.round(z * 1e6)))].sort();
	expect(rows(a)).toEqual(rows(b));
});

test('the pattern box of a body follows its longest level edge and spans all its faces', () => {
	const frame = createPatternFrame([
		{ origin: [0, 0, 0], across: [0, 1, 0], normal: [1, 0, 0], size: [8, 3], thickness: 0.1 },
		{ origin: [0, 0, 3], across: [0, 1, 0], normal: [0, 0, 1], size: [8, 2], thickness: 0.1 }
	]);
	expect(frame.axes[0]).toEqual([0, 1, 0]);
	expect(frame.axes[2]).toEqual([0, 0, 1]);
	expect(frame.size).toEqual([8, 2, 3]);
});

test('levels: plain and far draw a plain face, far only large graphic marks, near the rest', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [7.2, 6],
		thickness: 0.05,
		openings: [[1, 1, 2, 2]]
	};
	expect(buildSurface('perforated', patch, { level: 'far' }).meshes.has('mark')).toBe(false);
	expect(buildSurface('perforated', patch, { level: 'mid' }).meshes.has('mark')).toBe(false);
	expect(buildSurface('perforated', patch, { level: 'near' }).meshes.has('mark')).toBe(true);
	expect(buildSurface('stripe', patch, { level: 'plain' }).meshes.has('mark')).toBe(false);
	expect(buildSurface('stripe', patch, { level: 'far' }).meshes.has('mark')).toBe(true);
	const far = buildSurface('board', patch, { level: 'far' });
	expect([...far.meshes.keys()]).toEqual(['face']);
	expect(far.triangles).toBeLessThan(buildSurface('board', patch, { level: 'mid' }).triangles);
	expect(buildSurface('card', patch, { level: 'mid' }).lines).toEqual([]);
	expect(buildSurface('card', patch, { level: 'near' }).lines.length).toBeGreaterThan(0);
	expect(buildSurface('board', patch, { level: 'relief' })).toEqual(
		buildSurface('board', patch, { level: 'near' })
	);
	expect(buildSurface('board', patch, { level: 'flat' })).toEqual(
		buildSurface('board', patch, { level: 'plain' })
	);
});

test('the same inputs rebuild the same arrays; invalid patches and names throw RangeError', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [2, 2],
		thickness: 0.1
	};
	for (const family of familyNames)
		expect(buildSurface(family, patch)).toEqual(buildSurface(family, patch));
	expect(() => buildSurface('board', { ...patch, across: [1, 1, 0] })).toThrow(RangeError);
	expect(() => buildSurface('board', { ...patch, normal: [1, 0, 0] })).toThrow(RangeError);
	expect(() => buildSurface('board', { ...patch, size: [0, 2] })).toThrow(RangeError);
	expect(() =>
		buildSurface('board', {
			...patch,
			outline: [
				[0, 0],
				[0, 1],
				[1, 0]
			]
		})
	).toThrow(RangeError);
	expect(() => buildSurface('masonry' as never, patch)).toThrow(RangeError);
	expect(() => buildSurface('board', patch, { level: 'relief2' as never })).toThrow(RangeError);
});
