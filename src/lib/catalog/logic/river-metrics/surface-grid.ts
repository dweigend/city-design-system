export type SurfaceGrid = Readonly<{
	windowM: number;
	spacingM: number;
	bedMm: ArrayLike<number>;
	meanWaterMm: ArrayLike<number>;
}>;

/** Returns an interpolator over a centered, north-first square raster. */
export function gridSampler(side: number, spacing: number, valueAt: (index: number) => number) {
	const half = ((side - 1) * spacing) / 2;
	return (x: number, y: number) => {
		const column = Math.max(0, Math.min(side - 1, (half + x) / spacing));
		const row = Math.max(0, Math.min(side - 1, (half - y) / spacing));
		const left = Math.floor(column);
		const top = Math.floor(row);
		const right = Math.min(left + 1, side - 1);
		const bottom = Math.min(top + 1, side - 1);
		const dx = column - left;
		const dy = row - top;
		const nw = valueAt(top * side + left);
		const sw = valueAt(bottom * side + left);
		const north = nw + (valueAt(top * side + right) - nw) * dx;
		const south = sw + (valueAt(bottom * side + right) - sw) * dx;
		return north + (south - north) * dy;
	};
}

function reflect(index: number, length: number): number {
	const period = 2 * length;
	const folded = ((index % period) + period) % period;
	return Math.min(folded, period - 1 - folded);
}

function gaussian(radius: number, sigma: number): number[] {
	const weights = Array.from({ length: 2 * radius + 1 }, (_, index) =>
		Math.exp(-0.5 * ((index - radius) / sigma) ** 2)
	);
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	return weights.map((weight) => weight / total);
}

function convolve(input: Float64Array, side: number, weights: number[], vertical: boolean) {
	const radius = (weights.length - 1) / 2;
	const output = new Float64Array(input.length);
	for (let y = 0; y < side; y++) {
		for (let x = 0; x < side; x++) {
			let height = 0;
			for (let k = -radius; k <= radius; k++) {
				const position = vertical
					? reflect(y + k, side) * side + x
					: y * side + reflect(x + k, side);
				height += input[position] * weights[k + radius];
			}
			output[y * side + x] = height;
		}
	}
	return output;
}

/** Resamples the water-filled bed to a common grid and applies a reflected Gaussian. */
export function smoothSurface(grid: SurfaceGrid, spacing: number, sigma: number, truncate: number) {
	const sourceSide = grid.windowM / grid.spacingM + 1;
	const side = 2 * Math.floor(grid.windowM / (2 * spacing)) + 1;
	const center = (side - 1) / 2;
	const filled = gridSampler(
		sourceSide,
		grid.spacingM,
		(i) => Math.max(grid.bedMm[i], grid.meanWaterMm[i]) / 1000
	);
	const raw = new Float64Array(side ** 2);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			raw[row * side + column] = filled((column - center) * spacing, (center - row) * spacing);
		}
	}
	const sigmaCells = sigma / spacing;
	const weights = gaussian(Math.round(truncate * sigmaCells), sigmaCells);
	const heights = convolve(convolve(raw, side, weights, false), side, weights, true);
	return { side, center, heights };
}
