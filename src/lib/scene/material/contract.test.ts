import { expect, test } from 'bun:test';
import type { Vec3 } from '../../core/geometry';
import {
	buildSurface,
	createSampleBoard,
	createSampleBody,
	familyNames,
	readFamily,
	readLight,
	type Patch
} from './index';

const light = readLight([0.6, 0.8], 0.6);
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

test('every family builds on patches of several sizes and orientations inside the patch box', () => {
	for (const family of familyNames) {
		const { params, slots } = readFamily(family);
		const top = Math.max(...params.relief) * (1 + params.jitter) + params.joint + 0.01;
		for (const { across, normal } of orientations) {
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
				const mesh = buildSurface(family, patch, { light, seed: 7 });
				expect(mesh.level).toBe('relief');
				expect(mesh.triangles).toBeGreaterThan(0);
				for (const [slot, { positions, indices }] of mesh.meshes) {
					expect(slots).toContain(slot);
					expect(indices.length % 3).toBe(0);
					expect(Math.max(...indices)).toBeLessThan(positions.length / 3);
					for (let i = 0; i < positions.length; i += 3) {
						const [u, v, w] = local([positions[i], positions[i + 1], positions[i + 2]], patch);
						expect(u).toBeGreaterThanOrEqual(-1e-6);
						expect(u).toBeLessThanOrEqual(size[0] + 1e-6);
						expect(v).toBeGreaterThanOrEqual(-1e-6);
						expect(v).toBeLessThanOrEqual(size[1] + 1e-6);
						expect(w).toBeGreaterThanOrEqual(-patch.thickness - 1e-6);
						expect(w).toBeLessThanOrEqual(top);
					}
				}
			}
		}
	}
});

test('raised faces wind outward and nothing is drawn inside an opening', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [3, 2],
		thickness: 0.2,
		openings: [[1, 0.5, 2, 1.5]]
	};
	for (const family of familyNames) {
		const mesh = buildSurface(family, patch, { light });
		for (const [slot, { positions, indices }] of mesh.meshes) {
			for (let i = 0; i < indices.length; i += 3) {
				const [a, b, c] = [0, 1, 2].map((k) =>
					local(
						positions.slice(indices[i + k] * 3, indices[i + k] * 3 + 3) as unknown as Vec3,
						patch
					)
				);
				const normalW = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
				const center = [0, 1].map((k) => (a[k] + b[k] + c[k]) / 3);
				const front = Math.min(a[2], b[2], c[2]) >= -1e-9;
				if (front) expect(normalW).toBeGreaterThanOrEqual(-1e-9);
				const insideOpening =
					center[0] > 1 + 1e-6 &&
					center[0] < 2 - 1e-6 &&
					center[1] > 0.5 + 1e-6 &&
					center[1] < 1.5 - 1e-6;
				expect({ family, slot, insideOpening }).toEqual({ family, slot, insideOpening: false });
			}
		}
	}
});

test('geometry carries slots and meters only, never a colour', () => {
	const objects = [
		createSampleBoard(
			familyNames.map((family) => ({ family })),
			{ light }
		),
		createSampleBody('timber', { light })
	];
	for (const { object } of objects) {
		const text = JSON.stringify(object);
		expect(text).not.toMatch(/--|#[0-9a-f]{3}|rgb|oklch|color/i);
		for (const slot of object.slots)
			expect(slot).toMatch(/^(?:[a-z0-9-]+\/(?:unit|unit-alt|trim|joint|shade|shade-unit)|stand)$/);
	}
});

test('the same seed rebuilds the same arrays and another seed varies the units', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, 0, 1],
		size: [2, 2],
		thickness: 0.1
	};
	for (const family of familyNames) {
		const first = buildSurface(family, patch, { seed: 3, light });
		expect(buildSurface(family, patch, { seed: 3, light })).toEqual(first);
	}
	const a = buildSurface('masonry', patch, { seed: 3 });
	const b = buildSurface('masonry', patch, { seed: 4 });
	expect(a.meshes.get('unit')?.positions).not.toEqual(b.meshes.get('unit')?.positions);
});

test('invalid patches and families throw RangeError', () => {
	const patch: Patch = {
		origin: [0, 0, 0],
		across: [1, 0, 0],
		normal: [0, -1, 0],
		size: [2, 2],
		thickness: 0.1
	};
	expect(() => buildSurface('masonry', { ...patch, across: [1, 1, 0] })).toThrow(RangeError);
	expect(() => buildSurface('masonry', { ...patch, normal: [1, 0, 0] })).toThrow(RangeError);
	expect(() => buildSurface('masonry', { ...patch, size: [0, 2] })).toThrow(RangeError);
	expect(() =>
		buildSurface('masonry', {
			...patch,
			outline: [
				[0, 0],
				[0, 1],
				[1, 0]
			]
		})
	).toThrow(RangeError);
	expect(() => buildSurface('stone' as never, patch)).toThrow(RangeError);
});
