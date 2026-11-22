import { expect, test } from 'bun:test';
import { Valley } from '../../domain/valley';
import {
	VALLEY_FORM_BANDS as form,
	VALLEY_PICTURE_SEEDS,
	VALLEY_WINDOW_FORM as picture
} from './index';

function midpoint(valley: Valley, y: number) {
	const { seed, grid } = valley;
	const offset = ((grid.origin[1] - y) / grid.cellSize) * grid.side;
	const row = grid.bands.slice(offset, offset + grid.side);
	const left = row.indexOf(0);
	const right = row.lastIndexOf(0);
	expect(left, `Seed ${seed} western bank at ${y}`).toBeGreaterThan(0);
	expect(right, `Seed ${seed} eastern bank at ${y}`).toBeLessThan(grid.side - 1);
	expect(row.slice(left, right + 1).every((band) => band === 0)).toBe(true);
	return grid.origin[0] + ((left + right) / 2) * grid.cellSize;
}

function rms(values: readonly number[], mean = 0) {
	return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function maskDifference(a: Valley, b: Valley, level: number) {
	let union = 0;
	let difference = 0;
	for (const [index, value] of a.grid.bands.entries()) {
		const left = value === level;
		const right = b.grid.bands[index] === level;
		union += Number(left || right);
		difference += Number(left !== right);
	}
	return difference / union;
}

test('retains center clearance, complete banks and distinct form in the three picture frames', () => {
	const valleys = VALLEY_PICTURE_SEEDS.map((seed) => Valley.create({ seed }));
	expect(valleys.map(({ seed }) => seed)).toEqual([...VALLEY_PICTURE_SEEDS]);
	const lines = valleys.map((valley) => picture.pictureRowsM.map((y) => midpoint(valley, y)));
	for (const { seed, course } of valleys) {
		let nearest = Infinity;
		for (let offset = 0; offset < course.xy.length; offset += 2) {
			nearest = Math.min(nearest, Math.hypot(course.xy[offset], course.xy[offset + 1]));
		}
		console.log(`Seed ${seed} clearance ${nearest.toFixed(2)} m`);
		expect(nearest, String(seed)).toBeGreaterThanOrEqual(picture.minimumCenterClearanceM);
	}
	for (const [i, j] of [
		[0, 1],
		[0, 2],
		[1, 2]
	] as const) {
		const differences = lines[i].map((value, index) => value - lines[j][index]);
		const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
		const label = `${valleys[i].seed} / ${valleys[j].seed}`;
		const [line, shape, wet, floodplain] = [
			rms(differences),
			rms(differences, mean),
			maskDifference(valleys[i], valleys[j], 0),
			maskDifference(valleys[i], valleys[j], 1)
		];
		console.log(
			`${label}: line RMS ${line}, shape RMS ${shape}, wet difference ${wet}, floodplain difference ${floodplain}`
		);
		expect(line, label).toBeGreaterThanOrEqual(picture.minimumLineRmsM);
		expect(shape, label).toBeGreaterThanOrEqual(picture.minimumShapeRmsM);
		expect(wet, label).toBeGreaterThanOrEqual(form.minimumWetMaskDifference);
		expect(floodplain, label).toBeGreaterThanOrEqual(form.minimumFloodplainMaskDifference);
	}
});
