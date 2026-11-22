import type { TerrainField } from '../surface';
import type { ReachFrame } from './frame';

const sampleStep = 20;

/** Samples elevations and distance to the bank independently of the visible triangle grid. */
export function terrainField(frame: ReachFrame, width: number): TerrainField {
	const columns = Math.ceil(frame.length / sampleStep) + 1;
	const rows = Math.ceil(width / sampleStep) + 1;
	const dx = frame.length / (columns - 1);
	const dy = width / (rows - 1);
	const samples = new Float32Array(columns * rows * 4);
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const { height, bank } = frame.sample(column * dx - frame.length / 2, row * dy - width / 2);
			const i = 4 * (row * columns + column);
			samples[i] = height;
			samples[i + 3] = Math.max(-160, Math.min(160, bank));
		}
	}
	const heightAt = (column: number, row: number) => samples[4 * (row * columns + column)];
	for (let row = 0; row < rows; row++) {
		const back = Math.max(0, row - 1);
		const front = Math.min(rows - 1, row + 1);
		for (let column = 0; column < columns; column++) {
			const left = Math.max(0, column - 1);
			const right = Math.min(columns - 1, column + 1);
			const i = 4 * (row * columns + column);
			samples[i + 1] = (heightAt(right, row) - heightAt(left, row)) / ((right - left) * dx);
			samples[i + 2] = (heightAt(column, front) - heightAt(column, back)) / ((front - back) * dy);
		}
	}
	return { columns, rows, width: frame.length, depth: width, samples };
}
