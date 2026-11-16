// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { bullaugen, WOHNBAND, type Kugel } from './bullauge';
import { formFamily } from './index';
import { defaults, formOnCell } from './zellen';

const eine: Kugel[] = [{ center: [0, 0, 8], radius: 6 }];
const sued = -Math.PI / 2;

describe('bullaugen', () => {
	test('same seed, same windows in the same order; another seed, other positions', () => {
		const a = bullaugen(eine, 7, 7, sued);
		expect(bullaugen(eine, 7, 7, sued)).toEqual(a);
		expect(bullaugen(eine, 7, 8, sued)).not.toEqual(a);
	});

	test('windows lie entirely in the living band and on the sphere surface', () => {
		const list = bullaugen(eine, 10, 3, sued);
		expect(list.length).toBeGreaterThan(4);
		for (const b of list) {
			// Whole frame in the band: center at least the angular radius above the boundary.
			expect(b.breite - Math.asin(b.radius / 6)).toBeGreaterThanOrEqual(WOHNBAND[0] - 1e-9);
			expect(b.breite).toBeLessThanOrEqual(WOHNBAND[1] + 1e-9);
			const [x, y, z] = b.position;
			expect(Math.hypot(x, y, z - 8)).toBeCloseTo(6, 9);
		}
	});

	test('no frame touches another', () => {
		for (const saat of [1, 2, 3, 4, 5, 6]) {
			const list = bullaugen(eine, 14, saat, sued);
			for (let i = 0; i < list.length; i++)
				for (let j = i + 1; j < list.length; j++) {
					const [a, b] = [list[i], list[j]];
					// Chord ≤ arc: a chord distance greater than both radii means safely separated.
					const d = Math.hypot(
						a.position[0] - b.position[0],
						a.position[1] - b.position[1],
						a.position[2] - b.position[2]
					);
					expect(d).toBeGreaterThan((a.radius + b.radius) * 0.98);
				}
		}
	});

	test('the sunny side gets the most windows', () => {
		let sonne = 0,
			schatten = 0;
		for (let saat = 0; saat < 40; saat++)
			for (const b of bullaugen(eine, 4, saat, sued))
				if (Math.sin(b.azimut) < 0) sonne++;
				else schatten++;
		expect(sonne).toBeGreaterThan(schatten * 1.5);
	});

	test('no window lies inside the neighboring sphere; zero windows yields none', () => {
		const zwei: Kugel[] = [
			{ center: [0, 0, 6], radius: 5 },
			{ center: [1.5, 0, 14], radius: 5 }
		];
		for (const b of bullaugen(zwei, 12, 11, sued)) {
			const other = zwei[1 - b.kugel];
			const [x, y, z] = b.position;
			expect(
				Math.hypot(x - other.center[0], y - other.center[1], z - other.center[2])
			).toBeGreaterThan(other.radius);
		}
		expect(bullaugen(eine, 0, 1, sued)).toEqual([]);
	});

	test('sphere house draws frame and pane for every window', () => {
		const family = formFamily('kapsel-kugelhaus');
		if (!family) throw new Error('Family kapsel-kugelhaus missing');
		const params = defaults(family);
		const rings = formOnCell(family, 'square', params, 7).filter((p) => p.kind === 'ring');
		expect(rings.length).toBeGreaterThanOrEqual(8);
		expect(rings.length % 2).toBe(0);
		const ohne = formOnCell(family, 'square', { ...params, fenster: 0 }, 7);
		expect(ohne.filter((p) => p.kind === 'ring')).toEqual([]);
	});
});
