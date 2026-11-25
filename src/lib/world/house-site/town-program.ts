import { defaults } from '../../../config/house-site';
import { Random } from '../../core/random';
import type { StoreyProgram } from '../../domain/massing';
import { riverCityRecipe, type CityVerticalRecipe } from '../city-site';
import type { ParcelHouseRecipe } from './parcel';

type Use = StoreyProgram['use'];
const profiles: readonly (readonly Use[])[] = [
	['public', 'workshop', 'office'],
	['office', 'housing'],
	['city-farm', 'greenhouse']
];

/** The town places a compact upper addition above a taller retained hall (CITY-3, GROW-3). */
export function townHouseRecipe({
	levelHeightM
}: CityVerticalRecipe = riverCityRecipe): ParcelHouseRecipe {
	const hallShare = defaults.publicStoreyHeightM / riverCityRecipe.levelHeightM;
	const hallHeightM = hallShare * levelHeightM;
	return Object.freeze({
		key: 'town-house-program/1',
		vertical: Object.freeze({
			levelHeightM,
			storeyHeightsM: Object.freeze([hallHeightM, levelHeightM - hallHeightM])
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
}
