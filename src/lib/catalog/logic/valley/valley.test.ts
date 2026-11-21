import { expect, test } from 'bun:test';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from '../../data/valley-references';
import { clipPolylineToSquare, sinuosity } from '../river-metrics';
import { DEFAULT_VALLEY_PARAMETERS, generateValley } from './index';

test('replays the same course bytes with fresh buffers after generating another seed', () => {
	const first = generateValley({ seed: 1201 });
	const other = generateValley({ seed: 1301 });
	const replay = generateValley({ seed: 1201 });

	expect(first.version).toBe('valley/3');
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

test('derives wet width from a fixed ratio of bankfull width', () => {
	const seed = VALLEY_X1_SEEDS[0];
	const { course } = generateValley({ seed, parameters: { bankfullWidthM: [400, 400] } });
	expect(course.wetWidthM).toBe(376);
	const custom = generateValley({
		seed,
		parameters: { bankfullWidthM: [400, 400], wetToBankfullWidth: 0.85 }
	});
	expect(custom.course.wetWidthM).toBe(340);
	for (const ratio of [0, -0.1, 1.01, NaN, Infinity]) {
		expect(() => generateValley({ seed, parameters: { wetToBankfullWidth: ratio } })).toThrow(
			'invalid-valley-parameters'
		);
	}
});

function measure(xy: Float64Array, window: number, label: string): number {
	const reach = clipPolylineToSquare(xy, window);
	if (!reach) throw new Error(`${label}: empty ${window} m window`);
	expect(reach.borderHits, `${label}, ${window} m window`).toBe(protocol.borderHits);
	const half = window / 2;
	expect(Math.max(Math.abs(reach.xy[0]), Math.abs(reach.xy[1]))).toBe(half);
	expect(Math.max(Math.abs(reach.xy.at(-2) ?? NaN), Math.abs(reach.xy.at(-1) ?? NaN))).toBe(half);
	return sinuosity(reach.xy);
}

function measureCourse(xy: Float64Array, label: string) {
	return {
		sinuosity2km: measure(xy, protocol.localWindowM, label),
		sinuosity8km: measure(xy, protocol.regionalWindowM, label)
	};
}

function expectSinuosity(
	{ sinuosity2km, sinuosity8km }: ReturnType<typeof measureCourse>,
	label: string
) {
	expect(sinuosity2km, `${label} S₂ minimum`).toBeGreaterThanOrEqual(bands.sinuosity2km[0]);
	expect(sinuosity2km, `${label} S₂ maximum`).toBeLessThanOrEqual(bands.sinuosity2km[1]);
	expect(sinuosity8km, `${label} S₈ minimum`).toBeGreaterThanOrEqual(bands.sinuosity8km[0]);
	expect(sinuosity8km, `${label} S₈ maximum`).toBeLessThanOrEqual(bands.sinuosity8km[1]);
	expect(sinuosity8km, `${label} S₈ > S₂`).toBeGreaterThan(sinuosity2km);
}

function expectWetWidth(widthM: number, label: string) {
	expect(widthM, `${label} wet width minimum`).toBeGreaterThanOrEqual(bands.wetWidthM[0]);
	expect(widthM, `${label} wet width maximum`).toBeLessThanOrEqual(bands.wetWidthM[1]);
}

function median(values: number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

test('meets both sinuosity bands in order on all 38 frozen seeds', () => {
	const measured = [...VALLEY_X1_SEEDS, ...VALLEY_HOLDOUT_SEEDS].map((seed) => {
		const { course } = generateValley({ seed });
		expectWetWidth(course.wetWidthM, `Seed ${seed}`);
		return { seed, ...measureCourse(course.xy, `Seed ${seed}`) };
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

	for (const row of measured) expectSinuosity(row, `Seed ${row.seed}`);
	const median2km = median(measured.map((row) => row.sinuosity2km));
	const median8km = median(measured.map((row) => row.sinuosity8km));
	console.log(`Median S₂ = ${median2km.toFixed(6)}, median S₈ = ${median8km.toFixed(6)}`);
	expect(median8km, 'Median S₈ minimum').toBeGreaterThanOrEqual(bands.medianSinuosity8km[0]);
	expect(median8km, 'Median S₈ maximum').toBeLessThanOrEqual(bands.medianSinuosity8km[1]);
});

function rotate(xy: Float64Array, radians: number): Float64Array {
	const rotated = new Float64Array(xy.length);
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	for (let i = 0; i < xy.length; i += 2) {
		rotated[i] = xy[i] * cos - xy[i + 1] * sin;
		rotated[i + 1] = xy[i] * sin + xy[i + 1] * cos;
	}
	return rotated;
}

function measuredRange(values: number[]): string {
	return `${Math.min(...values).toFixed(4)}–${Math.max(...values).toFixed(4)}`;
}

test('meets both sinuosity bands at every default shape corner for the protocol bearings', () => {
	const { bankfullWidthM, headingAmplitude, wavelengthToWidth, phaseOffset } =
		DEFAULT_VALLEY_PARAMETERS;
	const seed = VALLEY_X1_SEEDS[0];
	// A straight course from the same seed reveals its bearing without using private hash channels.
	const straight = generateValley({ seed, parameters: { headingAmplitude: [0, 0] } }).course.xy;
	const bearing = Math.atan2(straight[3] - straight[1], straight[2] - straight[0]);
	const rows = [
		'| Bankfull (m) | Wet (m) | Amplitude (rad) | Wavelength / width | Phase (rad) | S₂ range | S₈ range | Min S₈ − S₂ |',
		'| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
	];
	for (const width of bankfullWidthM) {
		for (const phase of phaseOffset) {
			// Curvature uses one draw, so its two endpoints pair the amplitude and wavelength endpoints.
			for (const end of [0, 1] as const) {
				const amplitude = headingAmplitude[end];
				const wavelengthRatio = wavelengthToWidth[end];
				const { course } = generateValley({
					seed,
					parameters: {
						bankfullWidthM: [width, width],
						headingAmplitude: [amplitude, amplitude],
						wavelengthToWidth: [wavelengthRatio, wavelengthRatio],
						phaseOffset: [phase, phase]
					}
				});
				expectWetWidth(course.wetWidthM, `${width} m bankfull`);
				const results = protocol.cornerBearingsDeg.map((degrees) => {
					const label = `${width} m, amplitude ${amplitude}, ratio ${wavelengthRatio}, phase ${phase}, ${degrees}°`;
					const result = measureCourse(
						rotate(course.xy, (degrees * Math.PI) / 180 - bearing),
						label
					);
					expectSinuosity(result, label);
					return result;
				});
				const local = measuredRange(results.map((row) => row.sinuosity2km));
				const regional = measuredRange(results.map((row) => row.sinuosity8km));
				const minDelta = Math.min(...results.map((row) => row.sinuosity8km - row.sinuosity2km));
				rows.push(
					`| ${width} | ${course.wetWidthM.toFixed(1)} | ${amplitude} | ${wavelengthRatio} | ${phase} | ${local} | ${regional} | ${minDelta.toFixed(4)} |`
				);
			}
		}
	}
	console.log(rows.join('\n'));
});

test('rejects a high-amplitude, short-wavelength override that leaves the local band', () => {
	const parameters = {
		bankfullWidthM: [350, 350],
		phaseOffset: [0, 0],
		headingAmplitude: [0.79, 0.79],
		wavelengthToWidth: [11.5, 11.5]
	} as const;
	expect(() => generateValley({ seed: 14, parameters })).toThrow('valley-sinuosity-out-of-band');
	const paired = { ...parameters, wavelengthToWidth: [13.2, 13.2] } as const;
	expect(() => generateValley({ seed: 14, parameters: paired })).not.toThrow();
});
