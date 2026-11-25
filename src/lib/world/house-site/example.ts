import { required } from '../../core/invariant';
import { createCityLattice } from '../../domain/city-volume';
import { createParcelHouse, createTownHouseStudy, readFineCells } from './index';

// The first parcel on the default Town's perimeter block.
export function example() {
	const town = createTownHouseStudy();
	const parcel = required(town.parcelsByBlock.get(town.blocks.block.id)?.[0], 'town parcel');
	const site = required(town.readParcelSite(parcel.id), 'parcel site');
	return createParcelHouse(site, { height: 14, width: 30, complexity: 0.5, seed: 4 });
}

/** Reads the mixed-height fine cells of two adjacent canonical bays at a fixed datum. */
export function fineCellsExample() {
	const corners = [
		{ id: 'a', position: [0, 0, 10] },
		{ id: 'b', position: [10, 0, 10] },
		{ id: 'c', position: [10, 10, 10] },
		{ id: 'd', position: [0, 10, 10] },
		{ id: 'e', position: [20, 0, 10] },
		{ id: 'f', position: [20, 10, 10] }
	] as const;
	const [a, b, c, d, e, f] = corners;
	const lattice = createCityLattice(
		[
			{
				planCellId: 'west',
				corners: [a, b, c, d],
				neighbors: [null, 'east', null, null],
				levels: 2
			},
			{
				planCellId: 'east',
				corners: [b, e, f, c],
				neighbors: [null, null, null, 'west'],
				levels: 2
			}
		],
		10,
		'box'
	);
	const recipe = { storeyHeightsM: [3, 4] };
	return {
		lattice,
		west: readFineCells(lattice, 'west/level/0', 'fine-example', recipe),
		east: readFineCells(lattice, 'east/level/0', 'fine-example', recipe)
	};
}
