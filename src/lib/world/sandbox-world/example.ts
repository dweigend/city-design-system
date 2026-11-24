import { citySiteParams } from '../city-site';
import { createTownHouseStudy } from '../house-site';
import { createSandboxWorld } from './index';

/** Opens the Architecture Town fixture and addresses its first private parcel. */
export function example() {
	const town = createTownHouseStudy();
	const { site, layout, columns, parcelsByBlock, blocks } = town;
	const world = createSandboxWorld(
		{
			seed: layout.seed,
			planFamily: layout.variant,
			citySize: citySiteParams.citySize.default
		},
		site,
		layout,
		columns
	);
	const parcels = parcelsByBlock.get(blocks.block.id) ?? [];
	return { world, town, parcels };
}
