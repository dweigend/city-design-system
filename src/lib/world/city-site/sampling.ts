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
