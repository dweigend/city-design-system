/**
 * Bodies: every mass is a white wall under a thin floor plate that stands proud of it. Stacked
 * masses keep their plates visible — a house reads as modules that can be taken apart again.
 * Color rule: the shell stays white. A use shows its color in the openings, in its crown and
 * as a glazed coping along the roof edge of a mass that lies open to the sky.
 */
import { STORY } from '../../data/grid';
import type { ColorToken, Primitive } from '../parametrik/types';
import type { Point2 } from '../parametrik/vocab';
import type { QuadCell } from '../quad-grid';
import { accentOf, part, type Form, type Site } from './form';
import type { Mass } from './massing';
import { openings, WALL_INSET } from './openings';
import { boundaryRings, insetRing, ringArea, roundRing, type Fillet } from './outline';
import { storiesOf } from './stacks';

const FILLET: Fillet = { convex: 1.5, concave: 0.6 };
/** Floor plate on top of every story: thickness and inset from the cell sides, meters. */
const PLATE = { thickness: 0.32, inset: 0.12 };
/** The foot reaches this deep into the ground and is this much darker than the wall. */
const FOOT = { inset: 0.3, depth: 2.4, shade: 0.06 };
/** Deck of a raised mass: thickness and overhang beyond the cells, meters. */
const DECK = { thickness: 0.4, overhang: 0.2 };
const STILT = { radius: 0.17, embed: 0.8 };
/** Glaze of an open roof: a colored coping along its edge, meters. */
const COPING = { height: 0.22, width: 0.75 };

/** Slab outline of a cell set: outer ring plus courtyards, inset from the cell sides. */
function slab(cells: readonly QuadCell[], inset: number): { polygon: Point2[]; holes: Point2[][] } {
	const ids = new Set(cells.map((cell) => cell.id));
	const rings = boundaryRings(cells, (id) => ids.has(id))
		.map((ring) => roundRing(insetRing(ring, inset), FILLET))
		.sort((a, b) => ringArea(b) - ringArea(a));
	return { polygon: rings[0], holes: rings.slice(1).filter((ring) => ringArea(ring) < 0) };
}

const prism = (cells: readonly QuadCell[], inset: number, z: number, height: number): Form => ({
	kind: 'prism',
	...slab(cells, inset),
	z,
	height
});

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
function support(mass: Mass): Primitive[] {
	const grounded = mass.stories.filter((story) => story.level === 0).map((story) => story.cell);
	if (!grounded.length) return [];
	if (!mass.raised) {
		const foot = prism(grounded, FOOT.inset, mass.floor - FOOT.depth, FOOT.depth);
		return [{ ...part(`${mass.id}:foot`, '--paper', foot), shade: FOOT.shade }];
	}
	const deck = prism(grounded, -DECK.overhang, mass.floor - DECK.thickness, DECK.thickness);
	return [part(`${mass.id}:deck`, '--paper', deck), ...stilts(mass, grounded)];
}

/** True if no story of the mass is covered by another story. */
const isOpenToSky = (site: Site, mass: Mass) =>
	mass.stories.every((story) => storiesOf(site.stacks, story.cell.id).length === story.level + 1);

/** Colored coping along the roof edge of a mass that lies open to the sky. */
function coping(mass: Mass, cells: readonly QuadCell[], token: ColorToken): Primitive {
	const { polygon } = slab(cells, PLATE.inset);
	return part(`${mass.id}:coping`, token, {
		kind: 'prism',
		polygon,
		holes: [insetRing(polygon, COPING.width)],
		z: mass.floor + STORY,
		height: COPING.height
	});
}

/** Wall, floor plate, support and openings of one mass in the shared render contract. */
export function body(site: Site, mass: Mass): Primitive[] {
	const cells = mass.stories.map((story) => story.cell);
	const wallHeight = STORY - PLATE.thickness;
	const glaze = isOpenToSky(site, mass) ? accentOf(mass.use) : undefined;
	return [
		part(`${mass.id}:wall`, '--paper', prism(cells, WALL_INSET, mass.floor, wallHeight)),
		part(
			`${mass.id}:plate`,
			'--paper',
			prism(cells, PLATE.inset, mass.floor + wallHeight, PLATE.thickness)
		),
		...(glaze ? [coping(mass, cells, glaze)] : []),
		...support(mass),
		...openings(site, mass)
	];
}
