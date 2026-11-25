import { defaults } from '../../../config/house-site';
import { Random } from '../../core/random';
import type { StoreyProgram } from '../../domain/house-court';
import { riverCityRecipe } from '../city-site';
import type { ParcelHouseRecipe } from './parcel';

type Use = StoreyProgram['use'];
const profiles: readonly (readonly Use[])[] = [
	['public', 'workshop', 'office'],
	['office', 'housing'],
	['city-farm', 'greenhouse']
];

/** The town places a compact upper addition above a taller retained hall (CITY-3, GROW-3). */
export const townHouseRecipe: ParcelHouseRecipe = Object.freeze({
	vertical: Object.freeze({
		levelHeightM: riverCityRecipe.levelHeightM,
		storeyHeightsM: Object.freeze([
			defaults.publicStoreyHeightM,
			riverCityRecipe.levelHeightM - defaults.publicStoreyHeightM
		])
	}),
	storeyProgram(parcelId: string, baseDatumIndex: number) {
		const stream = Random.create({
			seed: /* Exact arithmetic: use profiles belong to parcel IDs. */ 0
		})
			.derive(parcelId)
			.derive('storey-program');
		const profile = profiles[Math.floor(stream.number() * profiles.length)];
		return (datumIndex: number): StoreyProgram => {
			const band = Math.max(0, datumIndex - baseDatumIndex);
			return {
				phase: band === 0 ? 'retained' : 'addition',
				use: profile[Math.min(band, profile.length - 1)]
			};
		};
	}
});
