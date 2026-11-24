import type { StoreySizing } from '../../domain/cell-space';
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
						datumZ + Math.ceil((groundZ - datumZ) / storeyHeightM) * storeyHeightM,
						roofZ - storeyHeightM
					);
		return { baseZ, storeyCount: Math.round((roofZ - baseZ) / storeyHeightM), storeyHeightM };
	}
	let level =
		groundZ === undefined
			? baseLevel
			: Math.min(Math.floor((groundZ - datumZ) / levelHeightM), roofLevel - 1);
	if (!Number.isSafeInteger(level)) throw new RangeError('Expected a valid coarse level index');
	const firstStorey = /* Exact arithmetic: index at the start of each coarse band. */ 0;
	let storey = firstStorey;
	let baseZ = datumZ + level * levelHeightM;
	while (
		groundZ !== undefined &&
		baseZ < groundZ &&
		(level < roofLevel - 1 || storey < storeysPerLevel - 1)
	) {
		baseZ += storeyHeightsM[storey];
		storey++;
		if (storey === storeysPerLevel) {
			storey = firstStorey;
			level++;
			baseZ = datumZ + level * levelHeightM;
		}
	}
	const storeyCount = (roofLevel - level) * storeysPerLevel - storey;
	return {
		baseZ,
		storeyCount,
		storeyHeightsM: Array.from(
			{ length: storeyCount },
			(_, index) => storeyHeightsM[(storey + index) % storeysPerLevel]
		)
	};
}
