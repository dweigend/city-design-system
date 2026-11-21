import { createHouseCourt, type HouseCourt } from '../house-court';
import { createTerrain, groundLevel, valleyPoint } from '../terrain';
import { createParcelDeck, type ParcelDeck } from '../parcel-deck';

const seed = 7;
const plotSpan = 12;
const along = 120;
const insetFromTerraceEdge = 60;

/** Creates the shared house-and-court example on a 12 m level plot on the seed-7 lower terrace. */
export function createHouseCourtExample(): { deck: ParcelDeck; house: HouseCourt } {
	const terrain = createTerrain({ seed });
	const across = terrain.bands.terraceEdge + insetFromTerraceEdge;
	const center = valleyPoint(terrain, along, across);
	const tangent = valleyPoint(terrain, along + 1, across);
	const dx = tangent[0] - center[0];
	const dy = tangent[1] - center[1];
	const half = plotSpan / 2;
	const length = Math.hypot(dx, dy);
	const x = (half * dx) / length;
	const y = (half * dy) / length;
	const z = groundLevel(terrain, ...center);
	const deck = createParcelDeck(
		{
			id: 'seed-7-lower-terrace',
			entrance: [
				[center[0] + y - x, center[1] - x - y, z],
				[center[0] + y + x, center[1] - x + y, z]
			],
			depth: plotSpan
		},
		{},
		seed
	);
	return { deck, house: createHouseCourt(deck) };
}
