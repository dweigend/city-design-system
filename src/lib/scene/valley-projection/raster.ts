import type { TerrainField } from '../surface';
import type { ReachFrame } from './frame';

const sampleStep = 20;

/** Samples elevations and distance to the bank independently of the visible triangle grid.
 * The first channel holds height divided by the contour step; gradients stay in true meters. */
export function terrainField(
	frame: ReachFrame,
	width: number
): { field: TerrainField; relief: number } {
	const columns = Math.ceil(frame.length / sampleStep) + 1;
	const rows = Math.ceil(width / sampleStep) + 1;
	const dx = frame.length / (columns - 1);
	const dy = width / (rows - 1);
	const samples = new Float32Array(columns * rows * 4);
	let low = Infinity;
	let high = -Infinity;
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const { height, bank } = frame.sample(column * dx - frame.length / 2, row * dy - width / 2);
			const i = 4 * (row * columns + column);
			samples[i] = height;
			low = Math.min(low, height);
			high = Math.max(high, height);
			samples[i + 3] = Math.max(-160, Math.min(160, bank));
		}
	}
	const heightAt = (column: number, row: number) => samples[4 * (row * columns + column)];
	// Average the cross-axis derivative over an 80 m band so that shadow does not
	// pick out individual solve-grid diagonals. Contours still read the true 20 m heights.
	for (let row = 0; row < rows; row++) {
		const back = Math.max(0, row - 1);
		const front = Math.min(rows - 1, row + 1);
		const south = Math.max(0, row - 2);
		const north = Math.min(rows - 1, row + 2);
		for (let column = 0; column < columns; column++) {
			const left = Math.max(0, column - 1);
			const right = Math.min(columns - 1, column + 1);
			const west = Math.max(0, column - 2);
			const east = Math.min(columns - 1, column + 2);
			const i = 4 * (row * columns + column);
			const along = (r: number) => heightAt(right, r) - heightAt(left, r);
			const across = (c: number) => heightAt(c, front) - heightAt(c, back);
			samples[i + 1] = (along(south) + 2 * along(row) + along(north)) / (4 * (right - left) * dx);
			samples[i + 2] =
				(across(west) + 2 * across(column) + across(east)) / (4 * (front - back) * dy);
		}
	}
	return {
		field: { columns, rows, width: frame.length, depth: width, samples },
		relief: high - low
	};
}
