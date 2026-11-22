import { expect, test } from 'bun:test';
import {
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_PICTURE_BEARING_RAD,
	VALLEY_PICTURE_SEEDS,
	VALLEY_WINDOW_FORM as form
} from '../../data/valley-references';
import { DEFAULT_VALLEY_PARAMETERS, generateValley, sampleValley, type ValleyField } from './index';

const grid = { windowM: protocol.localWindowM, spacingM: protocol.fieldSpacingM };

function wetMidpoints(field: ValleyField): number[] {
	const half = field.windowM / 2;
	const side = field.windowM / field.spacingM + 1;
	return form.pictureRowsM.map((y) => {
		const row = (half - y) / field.spacingM;
		const start = row * side;
		const area = field.floor.subarray(start, start + side);
		const west = area.indexOf(0);
		const east = area.lastIndexOf(0);
		expect(west, `Seed ${field.seed} west wet bank at y=${y}`).toBeGreaterThan(0);
		expect(east, `Seed ${field.seed} east wet bank at y=${y}`).toBeLessThan(side - 1);
		expect(area.subarray(west, east + 1).every((value) => value === 0)).toBe(true);
		return ((west + east) / 2) * field.spacingM - half;
	});
}

function rms(values: readonly number[], mean = 0): number {
	return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

test('places the center at least 125 m from the river in all three picture frames', () => {
	for (const seed of VALLEY_PICTURE_SEEDS) {
		const { course } = generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD });
		let nearestM = Infinity;
		for (let i = 0; i < course.xy.length; i += 2) {
			nearestM = Math.min(nearestM, Math.hypot(course.xy[i], course.xy[i + 1]));
		}
		console.log(`Seed ${seed} center clearance: ${nearestM.toFixed(2)} m`);
		expect(nearestM).toBeGreaterThanOrEqual(form.minimumCenterClearanceM);
	}
});

test('picture river lines differ in placement and shape', () => {
	const lines = VALLEY_PICTURE_SEEDS.map((seed) =>
		wetMidpoints(
			sampleValley(generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD }), grid)
		)
	);
	for (const [i, j] of [
		[0, 1],
		[0, 2],
		[1, 2]
	] as const) {
		const delta = lines[i].map((x, point) => x - lines[j][point]);
		const offset = delta.reduce((sum, value) => sum + value, 0) / delta.length;
		const name = `${VALLEY_PICTURE_SEEDS[i]} / ${VALLEY_PICTURE_SEEDS[j]}`;
		console.log(
			`${name}: line RMS ${rms(delta).toFixed(2)} m, shape RMS ${rms(delta, offset).toFixed(2)} m`
		);
		expect(rms(delta), name).toBeGreaterThanOrEqual(form.minimumLineRmsM);
		expect(rms(delta, offset), name).toBeGreaterThanOrEqual(form.minimumShapeRmsM);
	}
});

test('declares a window placement band spanning at least ±π/4', () => {
	const [min, max] = DEFAULT_VALLEY_PARAMETERS.windowPhaseOffset;
	expect(min).toBeLessThanOrEqual(-form.minimumPhaseHalfRangeRad);
	expect(max).toBeGreaterThanOrEqual(form.minimumPhaseHalfRangeRad);
});
