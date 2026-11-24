import { cityVolumeConfig as config } from '../../../config/city-volume';

export type SettlementKind = 'village' | 'town' | 'city';

/** Built-up area in km² at which a settlement becomes a town or a city. A village below 1 km²
 * holds a few thousand people and no high-rise; a small town reaches a few km² and gains a
 * closed block core; a high-rise center appears only once the built-up area is several km². */
export const settlementThresholds = Object.freeze({
	town: config.townAreaKm2,
	city: config.cityAreaKm2
});

/** Coarse levels of each fixed district kind: two-storey houses and six-storey blocks with a
 * common eaves line. Center columns start at the block eaves (the podium) and rise from there. */
export const districtLevels = Object.freeze({
	detached: config.detachedLevels,
	block: config.blockLevels
});

/** Largest level difference between two neighboring columns: six storeys, 21 m. */
export const maximumLevelStep = config.maximumNeighborStepLevels;

/** Peak levels at the city threshold and at the largest valley city, and that city's area.
 * The nominal cap rises from 42 m at 3 km² to 105 m at 8 km². A narrower center
 * can have a lower realized peak where the three-level neighbor limit applies. */
export const peakLaw = Object.freeze({
	firstLevels: config.firstPeakLevels,
	fullLevels: config.fullPeakLevels,
	fullArea: config.fullPeakAreaKm2
});

export function settlementOf(areaKm2: number): SettlementKind {
	if (areaKm2 >= settlementThresholds.city) return 'city';
	return areaKm2 >= settlementThresholds.town ? 'town' : 'village';
}

/** Area shares of block and center districts. Both shares rise with area, so a growing city
 * only converts cells upward: detached to block, block to center. */
export function districtShares(areaKm2: number) {
	const { town, city } = settlementThresholds;
	const block =
		areaKm2 < town
			? 0
			: Math.min(
					config.maximumBlockShare,
					config.firstBlockShare + config.blockSharePerKm2 * (areaKm2 - town)
				);
	const center =
		areaKm2 < city
			? 0
			: Math.min(
					config.maximumCenterShare,
					config.firstCenterShare + config.centerSharePerKm2 * (areaKm2 - city)
				);
	return { block, center };
}

/** Peak levels that the city's area allows, before the height cap. Zero below a city. */
export function peakLevels(areaKm2: number) {
	if (areaKm2 < settlementThresholds.city) return 0;
	const { firstLevels, fullLevels, fullArea } = peakLaw;
	const t = Math.min(
		1,
		(areaKm2 - settlementThresholds.city) / (fullArea - settlementThresholds.city)
	);
	return Math.round(firstLevels + t * (fullLevels - firstLevels));
}
