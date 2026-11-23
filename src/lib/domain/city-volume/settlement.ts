/** Number of storeys on one coarse lattice level. */
export const storeysPerLevel = 2;

/** Meters between common upper level planes. */
export const levelHeight = 3.5 * storeysPerLevel;

export type SettlementKind = 'village' | 'town' | 'city';

/** Built-up area in km² at which a settlement becomes a town or a city. A village below 1 km²
 * holds a few thousand people and no high-rise; a small town reaches a few km² and gains a
 * closed block core; a high-rise center appears only once the built-up area is several km². */
export const settlementThresholds = Object.freeze({ town: 1, city: 3 });

/** Coarse levels of each fixed district kind: two-storey houses and six-storey blocks with a
 * common eaves line. Center columns start at the block eaves (the podium) and rise from there. */
export const districtLevels = Object.freeze({ detached: 1, block: 3 });

/** Largest level difference between two neighboring columns: six storeys, 21 m. */
export const maximumLevelStep = 3;

/** Peak levels at the city threshold and at the largest valley city, and that city's area.
 * Real cities need tens of km² for a 140 m tower; the chapter compresses that range into the
 * valley terrace, so the peak grows linearly from 42 m at 3 km² to 140 m at 8 km². */
export const peakLaw = Object.freeze({ firstLevels: 6, fullLevels: 20, fullArea: 8 });

export function settlementOf(areaKm2: number): SettlementKind {
	if (areaKm2 >= settlementThresholds.city) return 'city';
	return areaKm2 >= settlementThresholds.town ? 'town' : 'village';
}

/** Area shares of block and center districts. Both shares rise with area, so a growing city
 * only converts cells upward: detached to block, block to center. */
export function districtShares(areaKm2: number) {
	const { town, city } = settlementThresholds;
	const block = areaKm2 < town ? 0 : Math.min(0.45, 0.18 + 0.09 * (areaKm2 - town));
	const center = areaKm2 < city ? 0 : Math.min(0.1, 0.05 + 0.01 * (areaKm2 - city));
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
