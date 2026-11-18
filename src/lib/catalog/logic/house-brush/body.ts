/**
 * Bodies: every mass is a white wall under a thin floor plate that stands proud of it. Stacked
 * masses keep their plates visible — a house reads as modules that can be taken apart again.
 * Color rule: the shell stays white. A use shows its color in the openings, in its crown and
 * as a glazed coping along the roof edge of a mass that lies open to the sky.
 */
import { STORY } from '../../data/grid';
import type { Primitive } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import { accentOf, part, type Form, type Site } from './form';
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
/** Glaze of an open roof: a colored coping along its edge, meters. */
const COPING_SHARE = 0.6;

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
	if (!profile.tiers) return [];
	const parts: Primitive[] = [];
	const accent = accentOf(mass.use);
	const top = mass.floor + STORY;
	const lipHeight = profile.rise * COPING_SHARE;
	const lip = slab(profile.setback, top, lipHeight);
	parts.push(part(mass.id + (accent ? ':coping' : ':lip'), accent ?? '--paper', lip));
	for (let tier = 0; tier < profile.tiers; tier++) {
		const lipBelow = tier === 0 ? lipHeight : 0;
		const inset = profile.setback * (tier === 0 ? 1.5 : tier + 1);
		const z = top + tier * profile.rise + lipBelow;
		parts.push(part(mass.id + ':tier' + tier, '--paper', slab(inset, z, profile.rise - lipBelow)));
	}
	return parts;
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
