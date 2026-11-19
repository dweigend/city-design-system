import { required } from '../required';
import { structuralSurface, houseSurfaces, type HouseSurfaces } from './surfaces';
import { bridgeRoute } from './bridge-route';
import { sectionObstacle, type HouseObstacle } from './clearance';
import { bridgeForm, type EnsembleDistrict } from '../district-frame';
import { neighborsOf, type QuadGrid } from '../quad-grid';
import { walkwayParts } from '../walkway';

import type { Section } from './types';

function near(grid: QuadGrid, s: Section, owners: Map<string, Section[]>) {
	const distances = new Map<Section, number>(),
		seen = new Set(s.cells.map((c) => c.id));
	let frontier = s.cells.map((c) => grid.cellsById.get(c.id) ?? c);
	for (let n = 1; n <= 3; n++) {
		frontier = frontier
			.flatMap((c) => neighborsOf(grid, c))
			.filter((c) => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				const other = owners.get(c.id);
				for (const house of other ?? [])
					distances.set(house, Math.min(distances.get(house) ?? Infinity, n));
				return true;
			});
	}
	return distances;
}
function link(
	a: Section,
	b: Section,
	distance: number,
	boxes: HouseObstacle[],
	seed: number,
	district: EnsembleDistrict,
	surfaces: HouseSurfaces
) {
	const id = 'link/' + a.id + '~' + b.id;
	const width = Math.max(0.5, Math.min(distance === 1 ? 2.8 : 1.5, a.width * 0.34, b.width * 0.34));
	const ends = new Set([...a.cells, ...b.cells].map((c) => c.id));
	const obstacles = boxes.filter(
		(box) => box.owner !== a.id && box.owner !== b.id && !(box.cell && ends.has(box.cell))
	);
	const candidates = a.decks
		.flatMap((left) =>
			b.decks.flatMap((right) => {
				const route = bridgeRoute(left, right, distance === 1, obstacles, width);
				return route ? [route] : [];
			})
		)
		.sort((l, r) => l.rise - r.rise || r.from[2] - l.from[2]);
	if (!candidates.length) return;
	const choices = [...new Set(candidates.map((c) => c.kind))];
	const kind = bridgeForm(a.id, b.id, id, choices, district, seed);
	const { from, to, route } = required(
		candidates.find((c) => c.kind === kind),
		'surveyed bridge form'
	);
	return {
		id,
		kind,
		a: a.id,
		b: b.id,
		from,
		to,
		route,
		width,
		parts: walkwayParts(route, {
			id: id + '/' + kind,
			width,
			groundZ: Math.max(from[2], to[2]),
			simplifyAtCity: true
		}).map((p) => ({ ...p, ...structuralSurface(surfaces.access) }))
	};
}
/** Connects visible deck pairs within three carrier sides, with stable undirected ownership. */
export function houseLinks(
	grid: QuadGrid,
	sections: Section[],
	seed: number,
	stock: HouseObstacle[] = [],
	surfaces = houseSurfaces
) {
	const owners = new Map<string, Section[]>();
	for (const s of sections)
		for (const cell of s.cells) owners.set(cell.id, [...(owners.get(cell.id) ?? []), s]);
	const boxes = [...sections.map(sectionObstacle), ...stock];
	return [...sections]
		.sort((a, b) => a.id.localeCompare(b.id))
		.flatMap((a) =>
			[...near(grid, a, owners)].flatMap(([b, distance]) => {
				if (a.id >= b.id) return [];
				const span = link(a, b, distance, boxes, seed, a.district, surfaces);
				return span ? [span] : [];
			})
		);
}
