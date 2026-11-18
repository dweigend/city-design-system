// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import {
	createTerrain,
	editReach,
	groundLevel,
	terrainHeight,
	terrainZone,
	valleyCoords,
	valleyPoint,
	type TerrainEdit
} from './index';

const SEEDS = [7, 1201, 1709, 4242];
/** Height noise of the creek's far tail, meters: below a hundredth of a millimeter. */
const HEIGHT_TOLERANCE = 1e-5;
const mid = (a: number, b: number) => (a + b) / 2;
/** Ground of the form rule at a position in the valley frame. */
const levelAt = (t: ReturnType<typeof createTerrain>, along: number, across: number) =>
	groundLevel(t, ...valleyPoint(t, along, across));

describe('terrain', () => {
	test('same seed, same ground; another seed, another ground', () => {
		const a = createTerrain({ seed: 7 });
		const b = createTerrain({ seed: 7 });
		const c = createTerrain({ seed: 8 });
		expect(b).toEqual(a);
		expect(terrainHeight(b, 31, -120)).toBe(terrainHeight(a, 31, -120));
		expect(terrainHeight(c, 31, -120)).not.toBe(terrainHeight(a, 31, -120));
	});

	test('the seed is normalized to u32', () => {
		expect(createTerrain({ seed: -1 }).seed).toBe(4294967295);
		expect(createTerrain({ seed: 7.9 }).seed).toBe(7);
		expect(createTerrain({ seed: Number.NaN }).seed).toBe(7);
	});

	test('the valley frame maps to the world and back', () => {
		const t = createTerrain({ seed: 7 });
		for (const [along, across] of [
			[0, 0],
			[380, 310],
			[760, 620],
			[123.4, 567.8]
		]) {
			const [backAlong, backAcross] = valleyCoords(t, ...valleyPoint(t, along, across));
			expect(backAlong).toBeCloseTo(along, 8);
			expect(backAcross).toBeCloseTo(across, 8);
		}
		expect(valleyPoint(t, t.along / 2, t.across / 2)).toEqual([0, 0]);
	});

	test('cross profile: river below water, terraces at 6 m and 12 m, then the ridge', () => {
		for (const seed of SEEDS) {
			const t = createTerrain({ seed });
			const { bands } = t;
			// Away from the creek: sample three positions along the valley and take the calmest.
			const profile = (across: number) =>
				[0.04, 0.5, 0.96].map((share) => levelAt(t, t.along * share, across));
			expect(Math.min(...profile(mid(bands.riverStart, bands.riverEnd)))).toBeLessThan(-2);
			expect(Math.max(...profile(mid(bands.terraceEdge + 40, bands.scarpStart - 25)))).toBe(6);
			expect(Math.max(...profile(bands.scarpEnd + 14))).toBeCloseTo(12, 5);
			expect(Math.max(...profile(t.across))).toBeGreaterThan(14);
		}
	});

	test('every contour is one curve along the valley: the ground never falls toward the ridge', () => {
		const t = createTerrain({ seed: 7 });
		for (let along = 0; along <= t.along; along += 40) {
			if (Math.abs(along - t.creekAlong) < 90) continue;
			let previous = levelAt(t, along, t.bands.riverEnd + 20);
			for (let across = t.bands.riverEnd + 25; across <= t.across; across += 5) {
				const level = levelAt(t, along, across);
				expect(level).toBeGreaterThanOrEqual(previous - HEIGHT_TOLERANCE);
				previous = level;
			}
		}
	});

	test('a basin digs the ground below the water and leaves the rest untouched', () => {
		const base = createTerrain({ seed: 7 });
		const center = valleyPoint(base, 300, base.bands.terraceEdge + 60);
		const edit: TerrainEdit = { kind: 'basin', center, radius: 9 };
		const dug = createTerrain({ seed: 7, edits: [edit] });
		expect(terrainZone(base, ...center)).toBe('lower-terrace');
		expect(groundLevel(dug, ...center)).toBeLessThan(dug.waterLevel);
		expect(terrainZone(dug, ...center)).toBe('water');
		const outside: [number, number] = [center[0] + editReach(edit) + 0.01, center[1]];
		expect(groundLevel(dug, ...outside)).toBe(groundLevel(base, ...outside));
	});
});
