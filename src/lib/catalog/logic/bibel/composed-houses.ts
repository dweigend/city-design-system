import { required } from '../required';
import { planHouse, sectionParts, houseLinks } from '../composed-house';
import type { HouseUse } from '../house-brush';
import { squareGrid, type QuadGrid } from '../quad-grid';
import type { RulePlate } from './hausregel';

const programme = {
	pavilion: ['energy', 'energy'],
	house: ['living', 'living', 'food', 'living'],
	rectangular: ['water', 'water', 'living', 'living', 'food', 'food', 'energy', 'energy'],
	round: [
		'water',
		'water',
		'material',
		'living',
		'living',
		'food',
		'food',
		'living',
		'food',
		'food',
		'food',
		'food'
	]
} satisfies Record<string, HouseUse[]>;

function house(grid: QuadGrid, id: string, uses: HouseUse[], seed: number) {
	const cell = required(grid.cellsById.get(id), 'plate cell');
	return planHouse({ cells: [cell], stacks: new Map([[id, uses]]), seed });
}
function single(
	id: keyof typeof programme,
	title: string,
	text: string,
	seed: number,
	span: number
): RulePlate {
	const section = house(squareGrid(1, 1, span), '0/0', programme[id], seed);
	return { id, title, text, primitives: sectionParts(section) };
}
function ensemble(): RulePlate {
	const grid = squareGrid(4, 3, 13);
	const sites = [
		house(grid, '0/0', programme.pavilion, 0),
		house(grid, '1/0', programme.house, 0),
		house(grid, '1/2', programme.rectangular, 0)
	];
	return {
		id: 'ensemble',
		title: 'Three neighbours',
		text: 'A shared platform, a skyway and a stair bridge connect three painted footprints.',
		primitives: [
			...sites.flatMap((s) => sectionParts(s)),
			...houseLinks(grid, sites, 0).flatMap((l) => l.parts)
		]
	};
}
/** The five executable composition plates, from a two-storey pavilion to a linked ensemble. */
export function composedHousePlates(): RulePlate[] {
	return [
		single(
			'pavilion',
			'Energy pavilion',
			'Two painted storeys carry a solar workshop above a service rack.',
			2,
			12
		),
		single(
			'house',
			'Garden house',
			'Four storeys of housing and food share an open terrace.',
			0,
			12
		),
		single(
			'rectangular',
			'Rectangular tower',
			'Eight mixed-use storeys on a continuous frame with projecting decks.',
			2,
			15
		),
		single('round', 'Round tower', 'Twelve mixed-use storeys surround a cylindrical core.', 1, 19),
		ensemble()
	];
}
