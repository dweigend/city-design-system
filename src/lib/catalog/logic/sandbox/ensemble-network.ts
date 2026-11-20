import type { planHouse, HouseObstacle } from '../composed-house';
import { courtLanding, publicFlight, type NetworkInput } from '../walkway-network';
import { required } from '../required';
import type { World } from './world-contract';
import { walkingHeight } from './network-terrain';
import { groundDeck } from './network-deck';
import { budgetedNetwork } from './network-budget';
import { networkParts } from './network-parts';
import { networkHouse, bodyBounds, overlaps, planBounds } from './network-site';
import { MODULE } from '../terrain-grid';

type Sections = ReturnType<typeof planHouse>[];
type Window = ReturnType<typeof planBounds>;
type Site = {
	terrain: NetworkInput['terrain'];
	blocked: (window: Window) => NetworkInput['blockedCells'];
	stock: readonly HouseObstacle[];
};

function windowOf(sections: Sections) {
	const bounds = planBounds(sections.flatMap((h) => h.cells.flatMap((c) => c.corners)));
	// The surrounding public lane is part of the survey. Allow one grid module beyond the painted plots.
	return {
		left: bounds.left - MODULE,
		right: bounds.right + MODULE,
		bottom: bounds.bottom - MODULE,
		top: bounds.top + MODULE
	};
}
function survey(sections: Sections, site: Site) {
	const window = windowOf(sections);
	const visits = sections.map(networkHouse);
	const houses = visits.map(({ id, entrance, obstacles }) => ({ id, entrance, obstacles }));
	const owners = new Set(houses.map((h) => h.id));
	const stock = site.stock.filter(
		(box) => !owners.has(box.owner ?? '') && overlaps(window, bodyBounds(box))
	);
	houses[0].obstacles.push(...stock);
	const terrain = (x: number, y: number) => {
		if (x < window.left + 1 || x > window.right - 1 || y < window.bottom + 1 || y > window.top - 1)
			return NaN;
		return site.terrain(x, y);
	};
	const ensembleArea = (window.right - window.left) * (window.top - window.bottom);
	return {
		houses,
		window,
		blockedCells: [...site.blocked(window), ...visits.flatMap((v) => v.overhangs)],
		terrain,
		ensembleArea,
		datum: sections[0].composition.datum
	};
}

/** Plans one ensemble of ground entrances. The optional cache belongs to one immutable terrain grid. */
export function ensembleNetwork(
	sections: Sections,
	site: Site,
	seed: number,
	cache?: NetworkCache
) {
	if (sections.length < 2) return;
	const input = survey(sections, site);
	const id = 'network/' + sections[0].id;
	const signature = JSON.stringify([seed, input, sections.map((h) => h.cells.map((c) => c.id))]);
	const saved = cache?.get(sections[0].id);
	if (saved?.signature === signature) return saved.group;
	const tree = budgetedNetwork(input, seed);
	const network = tree && groundDeck(tree, input.terrain);
	const group = network && {
		id,
		owners: sections.map((h) => h.id),
		cells: sections.flatMap((h) => h.cells.map((c) => c.id)),
		chunk: sections[0].cells[0].chunk,
		span: JSON.stringify([seed, network.geometry]),
		parts: () => networkParts(network, id, seed)
	};
	cache?.set(sections[0].id, { signature, group });
	return group;
}

type Group = {
	id: string;
	owners: string[];
	cells: string[];
	chunk: string;
	span: string;
	parts: () => ReturnType<typeof networkParts>;
};
export type NetworkCache = Map<string, { signature: string; group: Group | undefined }>;

/** Joins the lowest outward-facing deck at a court to its public landing.
 * Reach and going are surveyed on the actual house ports after a paint edit. */
export function courtFlights(world: World, sections: Sections) {
	const byCell = new Map(
		sections.filter((h) => !h.start).flatMap((h) => h.cells.map((c) => [c.id, h] as const))
	);
	const courts = world.state.city?.centres.flatMap((c) => c.ensembles ?? []) ?? [];
	return courts
		.filter((court) => court.openingPlots === undefined)
		.flatMap((court) => {
			const cell = required(world.grid.cellsById.get(court.court), 'public court');
			const a = courtLanding(cell).position;
			const options = court.lots
				.slice(0, 3)
				.flatMap((id) => courtPorts(byCell.get(id), a))
				.sort((l, r) => l.run - r.run);
			const port = options[0];
			if (!port) return [];
			const id = 'network/court/' + court.court;
			return [
				{
					id,
					owners: [port.house.id],
					cells: port.house.cells.map((c) => c.id),
					chunk: port.house.cells[0].chunk,
					span: JSON.stringify([a, port.b]),
					parts: () => publicFlight({ id, a, b: port.b }, (x, y) => walkingHeight(world.grid, x, y))
				}
			];
		});
}

function courtPorts(house: Sections[number] | undefined, a: Sections[number]['base']) {
	if (!house) return [];
	const [x, y] = house.base;
	return house.composition.ports
		.filter((p) => p.level === 0)
		.flatMap(({ position: b }) => {
			const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
			const facing = (a[0] - b[0]) * (b[0] - x) + (a[1] - b[1]) * (b[1] - y);
			return facing > 0 && run <= 14 && run >= 1.5 * Math.abs(b[2] - a[2])
				? [{ b, run, house }]
				: [];
		});
}
