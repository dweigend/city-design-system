import type { StoreySizing } from '../../domain/cell-space';
import { readLevelIndex } from '../../domain/city-volume';
import type { CityVerticalRecipe } from '../city-site';

/** Vertical addresses for one parcel share the city datum and end at the common roof plane. */
export function createParcelStoreySizing(
	{ levelHeightM, storeyHeightM, storeyHeightsM, storeysPerLevel }: CityVerticalRecipe,
	datumZ: number,
	baseLevel: number,
	roofLevel: number,
	groundZ?: number
): StoreySizing {
	const roofZ = datumZ + roofLevel * levelHeightM;
	if (!storeyHeightsM) {
		const baseZ =
			groundZ === undefined
				? datumZ + baseLevel * levelHeightM
				: Math.min(
						datumZ + Math.ceil(readLevelIndex(datumZ, groundZ, storeyHeightM)) * storeyHeightM,
						roofZ - storeyHeightM
					);
		return { baseZ, storeyCount: Math.round((roofZ - baseZ) / storeyHeightM), storeyHeightM };
	}
	let level =
		groundZ === undefined
			? baseLevel
			: Math.min(Math.floor(readLevelIndex(datumZ, groundZ, levelHeightM)), roofLevel - 1);
	if (!Number.isSafeInteger(level)) throw new RangeError('Expected a valid coarse level index');
	const firstStorey = /* Exact arithmetic: index at the start of each coarse band. */ 0;
	let storey = firstStorey;
	let bandZ = datumZ + level * levelHeightM;
	let offsetM = 0;
	while (
		groundZ !== undefined &&
		bandZ + offsetM < groundZ &&
		(level < roofLevel - 1 || storey < storeysPerLevel - 1)
	) {
		offsetM += storeyHeightsM[storey];
		storey++;
		if (storey === storeysPerLevel) {
			storey = firstStorey;
			level++;
			bandZ = datumZ + level * levelHeightM;
			offsetM = /* Exact arithmetic: reset to the coarse plane. */ 0;
		}
	}
	const storeyCount = (roofLevel - level) * storeysPerLevel - storey;
	return {
		baseZ: bandZ + offsetM,
		storeyCount,
		storeyHeightsM: Array.from(
			{ length: storeyCount },
			(_, index) => storeyHeightsM[(storey + index) % storeysPerLevel]
		)
	};
}
