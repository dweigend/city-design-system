import type { planHouse, HouseObstacle } from '../composed-house';
import type { NetworkInput } from '../walkway-network';
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
