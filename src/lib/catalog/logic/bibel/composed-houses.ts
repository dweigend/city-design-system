import { ensembleNetwork } from '../sandbox';
import { required } from '../required';
import { planEnsemble, type Typology } from '../house-typology';
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
	typology: Typology
): RulePlate {
	const cells = squareGrid(typology === 'portal-house' ? 2 : 1, 1, 10).cells;
	const site = { cells, stacks: new Map(cells.map((c) => [c.id, uses])), seed };
	const context = planEnsemble([site]);
	const houses = new Map(
		[...context.houses].map(([id, decision]) => [id, { ...decision, typology }])
	);
	const house = planHouse({ ...site, context: { ...context, houses } });
	return { id, title, text, primitives: sectionParts(house) };
}
function ensemble(): RulePlate {
	const grid = squareGrid(3, 1, 10);
	const stacks = new Map(grid.cells.map((c, i) => [c.id, mixed.slice(0, i + 2)]));
	const houses = paintedSections(grid, stacks, 0);
	return {
		id: 'ensemble',
		title: 'Three neighbours',
		text: 'Bridges connect the occupied decks at their shared two-metre datum.',
		primitives: [
			...houses.flatMap((h) => sectionParts(h)),
			...houseLinks(grid, houses, 0).flatMap((b) => b.parts)
		]
	};
}
function publicWalk(): RulePlate {
	const seed = 7,
		grid = squareGrid(3, 3, 12);
	const ids = ['0/0', '1/0', '1/1', '2/1', '1/2'];
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
			'Capsule stack',
			'Four inhabited levels carry rounded capsules in cradles.',
			Array<HouseUse>(4).fill('living'),
			1,
			'capsule-stack'
		),
		single(
			'house',
			'Deck tower',
			'Offset storeys alternate the house’s leading programme colour with pale shell. A recessed window band wraps each storey.',
			mixed,
			3,
			'deck-tower'
		),
		single(
			'round',
			'Round tower',
			'Circular decks carry drums above the waterfront.',
			Array<HouseUse>(8).fill('water'),
			0,
			'round-tower'
		),
		single(
			'rectangular',
			'Cluster mast',
			'Capsules turn around a shared mast on successive levels.',
			Array<HouseUse>(5).fill('living'),
			1,
			'cluster-mast'
		),
		single(
			'portal',
			'Portal house',
			'Two cores hold an inhabited bar above an open approach.',
			mixed,
			3,
			'portal-house'
		),
		ensemble(),
		publicWalk()
	];
}
