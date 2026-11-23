import type { WaterKind } from '../../domain/valley';

/** Reads the elevation and signed bank clearance in meters. An alternate sampler can supply
 * a water kind. Infinite clearance means no nearby water. */
export type CityTerrainSampler = (
	x: number,
	y: number
) => Readonly<{
	height: number;
	dry: boolean;
	waterClearance: number;
	waterKind?: WaterKind;
}>;
