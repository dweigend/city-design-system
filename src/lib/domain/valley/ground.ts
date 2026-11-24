import { defaults } from './settings';
import { millimetersPerMeter, toMillimeters } from './millimeters';
import type { ValleyAxis } from './valley-axis';

const { valleyRasterWindowM, valleyRasterCellSizeM } = defaults;

/** Ground bands in ascending order from the channel to the outer slope. */
export const valleyBands = Object.freeze(['channel', 'floodplain', 'terraces', 'slopes'] as const);

/** Index into valleyBands. */
export type ValleyBand = 0 | 1 | 2 | 3;

// Exact arithmetic: these indices address the named raster bands in their public order.
const band = /* Exact arithmetic: contiguous ground profile band indices. */ {
	channel: 0,
	floodplain: 1,
	terraces: 2,
	slopes: 3
} as const;

/** North-first square raster in meters. Columns run east and rows run south. */
export type HeightGrid = Readonly<{
	origin: readonly [west: number, north: number];
	cellSize: number;
	side: number;
	heights: readonly number[];
	waterHeights: readonly number[];
	bands: readonly ValleyBand[];
}>;

export const windowSize = valleyRasterWindowM;
const cellSize = valleyRasterCellSizeM;
const half = windowSize / 2;
export function heightGrid(
	sample: (x: number, y: number) => { height: number; water: number; bank: number },
	axis: ValleyAxis
): HeightGrid {
	const side = windowSize / cellSize + 1;
	const heights = new Array<number>(side ** 2);
	const waterHeights = new Array<number>(side ** 2);
	const bands = new Array<ValleyBand>(side ** 2);
	const [floodplain, lower, upper] = axis.floors;
	const lowerEdge = toMillimeters((floodplain.levelM + lower.levelM) / 2);
	const upperEdge = toMillimeters((lower.levelM + upper.levelM) / 2);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const { height, water, bank } = sample(-half + column * cellSize, half - row * cellSize);
			const above = Math.round((height - water) * millimetersPerMeter);
			heights[index] = height;
			waterHeights[index] = water;
			bands[index] =
				bank < 0
					? band.channel
					: above < lowerEdge
						? band.floodplain
						: above < upperEdge
							? band.terraces
							: band.slopes;
		}
	}
	return Object.freeze({
		origin: Object.freeze([-half, half] as const),
		cellSize,
		side,
		heights: Object.freeze(heights),
		waterHeights: Object.freeze(waterHeights),
		bands: Object.freeze(bands)
	});
}
