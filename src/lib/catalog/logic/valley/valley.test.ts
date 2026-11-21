import { expect, test } from 'bun:test';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from '../../data/valley-references';
import { clipPolylineToSquare, sinuosity } from '../river-metrics';
import { generateValley } from './index';

test('replays the same course bytes with fresh buffers after generating another seed', () => {
	const first = generateValley({ seed: 1201 });
	const other = generateValley({ seed: 1301 });
	const replay = generateValley({ seed: 1201 });

	expect(first.version).toBe('valley/1');
	expect(first.seed).toBe(1201);
	const bytes = (values: Float64Array) => new Uint8Array(values.buffer);
	expect(bytes(first.course.xy)).toEqual(bytes(replay.course.xy));
	expect(bytes(first.course.xy)).not.toEqual(bytes(other.course.xy));
	expect(bytes(first.course.chainageM)).toEqual(bytes(replay.course.chainageM));
	expect(first.course.bankfullWidthM).toBe(replay.course.bankfullWidthM);
	expect(first.course.xy.buffer).not.toBe(replay.course.xy.buffer);
	expect(first.course.chainageM.buffer).not.toBe(replay.course.chainageM.buffer);
});

test('rejects seeds outside the unsigned 32-bit integer domain', () => {
	for (const seed of [-1, 2 ** 32, NaN, Infinity, 0.5]) {
		expect(() => generateValley({ seed })).toThrow('invalid-seed');
	}
	expect(generateValley({ seed: 0 }).seed).toBe(0);
	expect(generateValley({ seed: 2 ** 32 - 1 }).seed).toBe(2 ** 32 - 1);
});

test('stores the centered course and chainage at 6.25 m intervals', () => {
	const { course } = generateValley({ seed: 1201 });
	const { xy, chainageM } = course;
	const middle = (chainageM.length - 1) / 2;
	expect(xy.length).toBe(chainageM.length * 2);
	expect(xy.slice(2 * middle, 2 * middle + 2)).toEqual(new Float64Array([0, 0]));

	for (let i = 1; i < chainageM.length; i++) {
		const dx = xy[2 * i] - xy[2 * (i - 1)];
		const dy = xy[2 * i + 1] - xy[2 * (i - 1) + 1];
		expect(chainageM[i]).toBe(i * protocol.courseSpacingM);
		expect(Math.hypot(dx, dy)).toBeCloseTo(protocol.courseSpacingM, 10);
	}
});

test('applies parameter bands and rejects a bend tighter than twice the width', () => {
	const { course } = generateValley({ seed: 1201, parameters: { bankfullWidthM: [400, 400] } });
	expect(course.bankfullWidthM).toBe(400);
	expect(() =>
		generateValley({
			seed: 1201,
			parameters: { wavelengthToWidth: [10, 10], headingAmplitude: [0, 0.8] }
		})
	).toThrow('invalid-valley-parameters');
});

function measure(xy: Float64Array, window: number, seed: number): number {
	const reach = clipPolylineToSquare(xy, window);
	if (!reach) throw new Error(`Seed ${seed}: empty ${window} m window`);
	expect(reach.borderHits, `Seed ${seed}, ${window} m window`).toBe(protocol.borderHits);
	const half = window / 2;
	expect(Math.max(Math.abs(reach.xy[0]), Math.abs(reach.xy[1]))).toBe(half);
	expect(Math.max(Math.abs(reach.xy.at(-2) ?? NaN), Math.abs(reach.xy.at(-1) ?? NaN))).toBe(half);
	return sinuosity(reach.xy);
}

test('meets both sinuosity bands in order on all 38 frozen seeds', () => {
	const measured = [...VALLEY_X1_SEEDS, ...VALLEY_HOLDOUT_SEEDS].map((seed) => {
		const { course } = generateValley({ seed });
		return {
			seed,
			sinuosity2km: measure(course.xy, protocol.localWindowM, seed),
			sinuosity8km: measure(course.xy, protocol.regionalWindowM, seed)
		};
	});
	const rows = [
		...VALLEY_REFERENCES.map((row) => ({ name: row.city, ...row })),
		...measured.map((row) => ({ name: String(row.seed), ...row }))
	];
	console.log(
		[
			'| Reference or seed | S₂ | S₈ |',
			'| --- | ---: | ---: |',
			...rows.map(
				({ name, sinuosity2km, sinuosity8km }) =>
					`| ${name} | ${sinuosity2km.toFixed(4)} | ${sinuosity8km.toFixed(4)} |`
			)
		].join('\n')
	);

	for (const { seed, sinuosity2km, sinuosity8km } of measured) {
		expect(sinuosity2km, `Seed ${seed} S₂ minimum`).toBeGreaterThanOrEqual(bands.sinuosity2km[0]);
		expect(sinuosity2km, `Seed ${seed} S₂ maximum`).toBeLessThanOrEqual(bands.sinuosity2km[1]);
		expect(sinuosity8km, `Seed ${seed} S₈ minimum`).toBeGreaterThanOrEqual(bands.sinuosity8km[0]);
		expect(sinuosity8km, `Seed ${seed} S₈ maximum`).toBeLessThanOrEqual(bands.sinuosity8km[1]);
		expect(sinuosity8km, `Seed ${seed} S₈ > S₂`).toBeGreaterThan(sinuosity2km);
	}
});
