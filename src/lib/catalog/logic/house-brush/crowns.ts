/**
 * Crowns: what stands on an open roof. Every use has one signature figure — dome, tank, sun
 * dish, greenhouse vault, shed roof. Figures are sized by the cell they stand on (its
 * inscribed circle and its side lengths), so they fit any cell shape. A single cell carries
 * its figure large; wide roofs carry small ones here and there.
 */
import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import type { ColorToken, Primitive } from '../parametrik/types';
import { inradius, sideLength, type QuadCell } from '../quad-grid';
import { accentOf, CHANNEL, part, type Form, type Site } from './form';
import type { Mass, Story } from './massing';
import { WALL_INSET } from './openings';
import { storiesOf, type HouseUse } from './stacks';

/** Share of the cells of a wide roof that carry a small crown. */
const SMALL_CROWN_SHARE = 0.22;
/** Scale of a small crown relative to the solo figure. */
const SMALL = 0.55;
/** Clear distance between a figure and the wall plane, meters. */
const ROOF_MARGIN = 0.25;

/** Where a figure stands: cell center on the roof, sizes taken from the cell. */
type Seat = Readonly<{
	x: number;
	y: number;
	z: number;
	/** Radius of the largest round figure, meters. */
	radius: number;
	/** Usable lengths along the cell's first and second side, meters. */
	width: number;
	depth: number;
	/** Direction of the cell's first side, radians. */
	turn: number;
	quarter: number;
	small: boolean;
}>;

type Piece = { token?: ColorToken; form: Form };

/** Signature figure of a use on a seat. `token` overrides the accent of the use. */
function figure(use: HouseUse, seat: Seat): Piece[] {
	const { x, y, z, radius: r, turn } = seat;
	switch (use) {
		case 'living':
			// Roof garden on wide roofs, a white dome on a single cell.
			return seat.small
				? [
						{
							token: '--paper',
							form: { kind: 'cylinder', position: [x, y, z], radius: 0.1, height: r }
						},
						{
							token: '--cat-nature',
							form: { kind: 'sphere', position: [x, y, z + r * 1.5], radius: r * 0.8 }
						}
					]
				: [{ token: '--paper', form: { kind: 'dome', position: [x, y, z], radius: r } }];
		case 'water':
			return [
				{
					token: '--paper',
					form: { kind: 'cylinder', position: [x, y, z], radius: r * 0.7, height: r * 0.4 }
				},
				{ form: { kind: 'sphere', position: [x, y, z + r * 1.1], radius: r * 0.9, squash: 0.86 } }
			];
		case 'energy':
			return [
				{
					token: '--paper',
					form: { kind: 'cylinder', position: [x, y, z], radius: 0.1, height: r * 1.25 }
				},
				{
					form: {
						kind: 'ring',
						position: [x, y, z + r * 1.25],
						radius: r * 0.95,
						innerRadius: 0,
						depth: 0.12,
						tilt: 0.95,
						rotation: turn + (seat.quarter * Math.PI) / 2
					}
				}
			];
		case 'food':
			return [
				{
					form: {
						kind: 'vault',
						position: [x, y, z],
						width: seat.width,
						length: seat.depth,
						rise: Math.min(seat.width, seat.depth) * 0.48,
						rotation: turn
					}
				}
			];
		case 'material':
			return [
				{
					form: {
						kind: 'wedge',
						position: [x - seat.width / 2, y - seat.depth / 2, z],
						size: [seat.width, seat.depth, Math.min(seat.width, seat.depth) * 0.55],
						low: 0.28,
						rotation: turn + (seat.quarter % 2) * Math.PI
					}
				}
			];
	}
}

function seatOf(site: Site, cell: QuadCell, top: number, small: boolean): Seat {
	const scale = small ? SMALL : 1;
	const clear = WALL_INSET + ROOF_MARGIN;
	return {
		x: cell.center[0],
		y: cell.center[1],
		z: top,
		radius: Math.max(0.4, inradius(cell) - clear) * scale,
		width: Math.max(0.8, (sideLength(cell, 0) + sideLength(cell, 2)) / 2 - 2 * clear) * scale,
		depth: Math.max(0.8, (sideLength(cell, 1) + sideLength(cell, 3)) / 2 - 2 * clear) * scale,
		turn: Math.atan2(
			cell.corners[1][1] - cell.corners[0][1],
			cell.corners[1][0] - cell.corners[0][0]
		),
		quarter: Math.floor(hash(site.seed, cell.index, CHANNEL.crownTurn) * 4),
		small
	};
}

/** Stories of the mass that lie open to the sky. */
function roofStories(site: Site, mass: Mass): Story[] {
	return mass.stories.filter(
		(story) => storiesOf(site.stacks, story.cell.id).length === story.level + 1
	);
}

/**
 * Crowns of a mass. A mass of one cell gets the solo figure; wider roofs get small figures
 * on a seeded share of their cells. Deterministic per cell.
 */
export function crowns(site: Site, mass: Mass): Primitive[] {
	const solo = mass.stories.length === 1;
	const top = mass.floor + STORY;
	return roofStories(site, mass).flatMap((story) => {
		const carries = solo || hash(site.seed, story.cell.index, CHANNEL.crown) < SMALL_CROWN_SHARE;
		if (!carries) return [];
		return figure(mass.use, seatOf(site, story.cell, top, !solo)).map(({ token, form }, k) => ({
			...part(
				`${story.cell.id}@${story.level}:crown${k}`,
				token ?? accentOf(mass.use) ?? '--paper',
				form
			),
			detail: true
		}));
	});
}
