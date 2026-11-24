import type { WaterKind } from '../../domain/valley';

export type CityTerrainReading = Readonly<
	{
		height: number;
		waterClearance: number;
	} & (
		| { waterKind: null; waterHeight?: never }
		| { waterKind: NonNullable<WaterKind> | 'water'; waterHeight: number }
	)
>;

/** Reads ground elevation, signed bank clearance and any water surface in meters.
 * Positive infinity means no nearby water. A null water kind denotes dry ground. */
export type CityTerrainSampler = (x: number, y: number) => CityTerrainReading;

/** Shares the last pure terrain reading between the plan grid's clearance and height callbacks. */
export function planGround(sample: CityTerrainSampler, bankSetbackM: number) {
	let lastX: number;
	let lastY: number;
	let last: CityTerrainReading | undefined;
	function read(x: number, y: number) {
		if (last && x === lastX && y === lastY) return last;
		last = sample(x, y);
		lastX = x;
		lastY = y;
		return last;
	}
	return {
		clearanceAt: (x: number, y: number) => read(x, y).waterClearance - bankSetbackM,
		heightAt: (x: number, y: number) => {
			const reading = read(x, y);
			return reading.waterKind === null ? reading.height : undefined;
		}
	};
}
