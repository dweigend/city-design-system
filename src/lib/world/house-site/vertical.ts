import { createMixedStoreyBoundaries, type StoreySizing } from '../../domain/cell-space';
import { readLevelIndex } from '../../domain/city-volume';
import type { CityVerticalRecipe } from '../city-site';

/** Clips the active window against the elevations of the uncut datum stack. */
export function createParcelStoreySizing(
	{ levelHeightM, storeyHeightM, storeyHeightsM, storeysPerLevel }: CityVerticalRecipe,
	datumZ: number,
	baseLevel: number,
	roofLevel: number,
	groundZ?: number
): StoreySizing {
	const end = roofLevel * storeysPerLevel;
	if (!storeyHeightsM) {
		const datumIndex =
			groundZ === undefined
				? baseLevel * storeysPerLevel
				: Math.min(Math.ceil(readLevelIndex(datumZ, groundZ, storeyHeightM)), end - 1);
		const baseZ = datumZ + datumIndex * storeyHeightM;
		const storeyCount = end - datumIndex;
		const storeyElevationsM = Array.from(
			{ length: storeyCount + 1 },
			(_, index) => datumZ + (datumIndex + index) * storeyHeightM
		);
		return { baseZ, datumIndex, storeyCount, storeyHeightM, storeyElevationsM };
	}
	const level =
		groundZ === undefined
			? baseLevel
			: Math.min(Math.floor(readLevelIndex(datumZ, groundZ, levelHeightM)), roofLevel - 1);
	const first = (groundZ === undefined ? level : level - 1) * storeysPerLevel;
	if (!Number.isSafeInteger(first) || !Number.isSafeInteger(end))
		throw new RangeError('Expected a valid coarse level range');
	const boundaries = createMixedStoreyBoundaries(
		datumZ,
		storeyHeightsM,
		levelHeightM,
		first,
		end - first
	);
	const match = groundZ === undefined ? 0 : boundaries.findIndex((height) => height >= groundZ);
	const lastStorey = boundaries.length - 2;
	const start = match < 0 ? lastStorey : Math.min(match, lastStorey);
	const datumIndex = first + start;
	return {
		baseZ: boundaries[start],
		datumIndex,
		storeyCount: end - datumIndex,
		storeyElevationsM: boundaries.slice(start),
		storeyHeightsM: Array.from({ length: end - datumIndex }, (_, index) => {
			const band = (datumIndex + index) % storeysPerLevel;
			return storeyHeightsM[band < 0 ? band + storeysPerLevel : band];
		})
	};
}
