import { ensembleNetwork } from '../sandbox';
import { required } from '../required';
import type { HouseEnvelope } from '../house-typology';
import { planHouse, sectionParts, houseLinks, paintedSections } from '../composed-house';
import type { HouseUse } from '../house-brush';
import { squareGrid } from '../quad-grid';
import type { RulePlate } from './hausregel';

const mixed: HouseUse[] = ['water', 'living', 'food', 'energy'];
function single(
	id: string,
	title: string,
	text: string,
	uses: HouseUse[],
	seed: number,
	envelope: Partial<HouseEnvelope>
): RulePlate {
	const cells = squareGrid(id === 'portal' ? 2 : 1, 1, 10).cells;
	const site = { cells, stacks: new Map(cells.map((c) => [c.id, uses])), seed };
	const house = planHouse({ ...site, envelope });
	return { id, title, text, primitives: sectionParts(house) };
}
function ensemble(): RulePlate {
	const grid = squareGrid(3, 1, 10);
	const stacks = new Map(
		grid.cells.map((c, i) => [
			c.id,
			Array.from({ length: i + 6 }, (_, level) => mixed[level % mixed.length])
		])
	);
	const houses = paintedSections(grid, stacks, 0);
	return {
		id: 'ensemble',
		title: 'Three neighbours',
		text: 'Two inhabited galleries cross the party walls at a common floor height.',
		primitives: [
			...houses.flatMap((h) => sectionParts(h)),
			...houseLinks(grid, houses, 0).flatMap((b) => b.parts)
		]
	};
}
function publicWalk(): RulePlate {
	const seed = 9,
		grid = squareGrid(5, 5, 12);
	const ids = ['0/1', '1/1', '2/1', '3/1', '4/1'];
	const stacks = new Map(ids.map((id, i) => [id, mixed.slice(0, [2, 4, 1, 3, 2][i])]));
	const houses = paintedSections(grid, stacks, seed);
	const site = { terrain: () => 0, blocked: () => [], stock: [] };
	const path = required(ensembleNetwork(houses, site, seed), 'five-house public walkway');
	return {
		id: 'public-walk',
		title: 'One public walkway',
		text: 'A branching ground path meets the foot of each house stair. Small groups of people mark its scale.',
		primitives: [
			...houses.flatMap((h) => sectionParts(h)),
			...houseLinks(grid, houses, seed).flatMap((b) => b.parts),
			...path.parts()
		]
	};
}
/** Five single-house typologies and two ensembles with their shared circulation. */
export function composedHousePlates(): RulePlate[] {
	return [
		single(
			'pavilion',
			'Inflated vessel',
			'A continuous cushion skin wraps four inhabited levels.',
			Array<HouseUse>(4).fill('living'),
			1,
			{ system: 'inflated-cushion', section: 'vessel' }
		),
		single(
			'house',
			'Pleated tower',
			'Folded panels follow the changing width of the occupied floors.',
			mixed,
			3,
			{ system: 'pleated-sheet', section: 'folded-fan' }
		),
		single(
			'round',
			'Woven lantern',
			'A woven outer frame narrows at the neck of the eight-storey section.',
			Array<HouseUse>(8).fill('water'),
			0,
			{ system: 'woven-basket', section: 'lantern-neck' }
		),
		single(
			'rectangular',
			'Service spiral',
			'Service runs wind around the inhabited volume.',
			Array<HouseUse>(5).fill('living'),
			1,
			{ system: 'helical-services', section: 'spiral-terrace' }
		),
		single('portal', 'Ribbed longhouse', 'Arch ribs repeat along the two-cell parcel.', mixed, 3, {
			system: 'arch-ribs',
			section: 'longhouse'
		}),
		ensemble(),
		publicWalk()
	];
}
