import { bridgePair } from './people';
import { required } from '../required';
import { houseSurfaces, sectionSurfaces, type HouseSurfaces } from './surfaces';
import { bridgeRoute } from './bridge-route';
import { sectionObstacle, type HouseObstacle } from './clearance';
import { bridgeForm, type EnsembleDistrict } from '../district-frame';
import { neighborsOf, type QuadGrid } from '../quad-grid';
import { bridgeParts } from './bridge-parts';

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
	// A shared inhabited wall already connects these lots at the podium.
	if (
		distance === 1 &&
		a.composition.levels[0].bodies[0].band?.footprint &&
		b.composition.levels[0].bodies[0].band?.footprint
	)
		return;
	const id = 'link/' + a.id + '~' + b.id;
	const width = 2.5;
	const ends = new Set([...a.cells, ...b.cells].map((c) => c.id));
	const obstacles = boxes.filter(
		(box) => box.owner !== a.id && box.owner !== b.id && !(box.cell && ends.has(box.cell))
	);
	const candidates = a.composition.ports
		.flatMap((left) =>
			b.composition.ports.flatMap((right) => {
				const route = bridgeRoute(left.position, right.position, distance === 1, obstacles, width);
				return route ? [route] : [];
			})
		)
		.sort((l, r) => l.rise - r.rise || l.run - r.run || l.from[2] - r.from[2]);
	if (!candidates.length) return;
	const choices = [...new Set(candidates.map((c) => c.kind))];
	const kind = bridgeForm(a.id, b.id, id, choices, district, seed);
	const { from, to, route, run, thresholds } = required(
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
		distance,
		run,
		parts: bridgeParts(route, id + '/' + kind, width, surfaces, thresholds)
	};
}
type Span = NonNullable<ReturnType<typeof link>>;
/** Most bridges one house may carry. */
const DEGREE = 2;
/** Houses per permitted closed ring in the bridge network. */
const RING = 6;

/** Keeps a spanning forest of the shortest spans, with one closed ring per six houses. */
function budget(spans: Span[], houses: number) {
	const root = new Map<string, string>(),
		degree = new Map<string, number>();
	const find = (id: string): string => {
		const parent = root.get(id) ?? id;
		return parent === id ? id : find(parent);
	};
	let rings = Math.floor(houses / RING);
	return spans
		.sort((l, r) => l.distance - r.distance || l.run - r.run || l.id.localeCompare(r.id))
		.filter(({ a, b }) => {
			const full = [a, b].some((id) => (degree.get(id) ?? 0) >= DEGREE);
			const joined = find(a) === find(b);
			if (full || (joined && rings-- <= 0)) return false;
			root.set(find(a), find(b));
			for (const id of [a, b]) degree.set(id, (degree.get(id) ?? 0) + 1);
			return true;
		})
		.sort((l, r) => l.id.localeCompare(r.id));
}
/** Connects neighbouring houses at equal deck levels. Each house carries at most two bridges and
 * the network stays a forest with one ring per six houses, with stable undirected ownership. */
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
	const palettes = new Map(sections.map((s) => [s.id, sectionSurfaces(s, surfaces)]));
	const boxes = [...sections.map(sectionObstacle), ...stock];
	const spans = [...sections]
		.sort((a, b) => a.id.localeCompare(b.id))
		.flatMap((a) =>
			[...near(grid, a, owners)].flatMap(([b, distance]) => {
				if (a.id >= b.id) return [];
				const span = link(
					a,
					b,
					distance,
					boxes,
					seed,
					a.district,
					required(palettes.get(a.id), 'bridge palette')
				);
				return span ? [span] : [];
			})
		);
	const occupied = new Set<string>();
	return budget(spans, sections.length).map((span) => {
		const owner = [span.a, span.b].find((id) => !occupied.has(id));
		if (!owner) return span;
		const pair = bridgePair(
			span.route,
			span.id,
			seed,
			required(palettes.get(owner), 'bridge palette')
		);
		if (pair.length) occupied.add(owner);
		return { ...span, parts: [...span.parts, ...pair] };
	});
}
