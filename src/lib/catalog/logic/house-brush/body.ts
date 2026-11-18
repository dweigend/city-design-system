/** Historic terrace shells, supports and wall openings. */
import { STORY } from '../../data/grid';
import type { Primitive } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import { part, type Form, type Site } from './form';
import type { Mass } from './massing';
import { openings } from './openings';
import { boundaryRings, insetRing, ringArea, roundRing, type Fillet } from './outline';
import type { Profile } from './profile';
import { pilotis } from './pilotis';

/** Floor plate on top of every story: thickness and inset from the cell sides, meters. */
const PLATE = { thickness: 0.32, inset: 0.12 };
/** The foot reaches this deep into the ground and is this much darker than the wall. */
const FOOT = { inset: 0.3, depth: 2.4, shade: 0.06 };
/** Deck of a raised mass: thickness and overhang beyond the cells, meters. */
const DECK = { thickness: 0.4, overhang: 0.2 };
const STILT = { radius: 0.17, embed: 0.8 };
/** Traces once per footprint; each slab retains the outer ring and every courtyard. */
function slabOf(cells: readonly QuadCell[], fillet: Fillet) {
	const ids = new Set(cells.map((cell) => cell.id));
	const rings = boundaryRings(cells, (id) => ids.has(id)).sort((a, b) => ringArea(b) - ringArea(a));
	const [outer, ...inner] = rings;
	const boundaries = [outer, ...inner.filter((ring) => ringArea(ring) < 0)];
	return (inset: number, z: number, height: number): Form => {
		const [polygon, ...holes] = boundaries.map((ring) => roundRing(insetRing(ring, inset), fillet));
		return { kind: 'prism', polygon, holes, z, height };
	};
}

type Slab = ReturnType<typeof slabOf>;

/** One stilt under every grid corner of the raised cells, down into the ground. */
function stilts(mass: Mass, cells: readonly QuadCell[]): Primitive[] {
	const feet = new Map<string, readonly [number, number, number]>();
	for (const cell of cells)
		cell.corners.forEach((corner, k) => feet.set(cell.vertexIds[k], corner));
	const top = mass.floor - DECK.thickness;
	return [...feet].map(([vertexId, [x, y, ground]]) =>
		part(`${mass.id}:stilt${vertexId}`, '--paper', {
			kind: 'cylinder',
			position: [x, y, ground - STILT.embed],
			radius: STILT.radius,
			height: top - ground + STILT.embed
		})
	);
}

/** What carries the ground stories: a foot in the ground, or a deck on stilts where it floods. */
function support(mass: Mass, fillet: Fillet): Primitive[] {
	const grounded = mass.stories.filter((story) => story.level === 0).map((story) => story.cell);
	if (!grounded.length) return [];
	const slab = slabOf(grounded, fillet);
	if (!mass.raised) {
		const foot = slab(FOOT.inset, mass.floor - FOOT.depth, FOOT.depth);
		return [{ ...part(`${mass.id}:foot`, '--paper', foot), shade: FOOT.shade }];
	}
	const deck = slab(-DECK.overhang, mass.floor - DECK.thickness, DECK.thickness);
	return [part(`${mass.id}:deck`, '--paper', deck), ...stilts(mass, grounded)];
}

/** Each tread follows all boundary rings, including the edges facing a courtyard. */
function roof(mass: Mass, slab: Slab, profile: Profile): Primitive[] {
	return Array.from({ length: profile.tiers }, (_, tier) => {
		const inset = profile.setback * (tier + 1);
		const floor = mass.floor + STORY + tier * profile.rise;
		return part(mass.id + ':tier' + tier, '--paper', slab(inset, floor, profile.rise));
	});
}

/** Wall, floor plate, support and openings of one mass in the shared render contract. */
export function body(site: Site, mass: Mass, profile: Profile): Primitive[] {
	const cells = mass.stories.map((story) => story.cell);
	const slab = slabOf(cells, profile.fillet);
	const wallHeight = STORY - PLATE.thickness;

	return [
		part(`${mass.id}:wall`, '--paper', slab(profile.wallInset, mass.floor, wallHeight)),
		part(
			`${mass.id}:plate`,
			'--paper',
			slab(PLATE.inset, mass.floor + wallHeight, PLATE.thickness)
		),
		...roof(mass, slab, profile),
		...(profile.arcade ? pilotis(mass, cells, wallHeight, profile.wallInset) : []),
		...support(mass, profile.fillet),
		...openings(site, mass, profile.wallInset)
	];
}
