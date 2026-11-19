/**
 * Openings: every use has its own window figure, so the function of a house reads without
 * color (second channel, DS-23). Figures are sized by the wall they sit on, so they fit any
 * cell shape. Openings sit on free outer walls only.
 */
import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import { cellKey } from './cell-key';
import type { Primitive } from '../parametrik/types';
import { sideLength, type QuadCell } from '../quad-grid';
import { CHANNEL, detail, type Form, type Site } from './form';
import { wallMargin } from './ensemble-walls';
import { floorOf, massStoreys, type Mass, type Story } from './massing';
import { storiesOf, type HouseUse } from './stacks';

/** Share of free walls that carry an opening. */
const OPENING_SHARE = 0.66;
/** Thickness of an opening and how far it stands proud of the wall, meters. */
const RELIEF = { depth: 0.2, proud: 0.07 };
/** Height band of a story that an adjacent story must leave free for an opening, meters. */
const CLEAR_BAND = { from: 0.8, to: 3.2 };
/** Free wall length a figure may use: the side minus the insets and corner fillets, as shares. */
const WALL_SHARE = { corner: 0.4, run: 0.72 };

/** Wall-local figure: `along` the wall from its middle, `up` from the floor, meters. */
type Figure =
	| { kind: 'disc'; along: number; up: number; radius: number }
	| { kind: 'panel'; along: number; up: number; width: number; height: number };

/** Figures of a use on a wall with `width` meters of free length. */
function figures(use: HouseUse, level: number, width: number): Figure[] {
	const panel = (along: number, up: number, w: number, height: number): Figure => ({
		kind: 'panel',
		along,
		up,
		width: w,
		height
	});
	switch (use) {
		case 'living':
			// Ribbon window.
			return [panel(0, 2.25, width, 1)];
		case 'water':
			// Porthole.
			return [{ kind: 'disc', along: 0, up: 2.05, radius: Math.min(0.95, width * 0.45) }];
		case 'energy': {
			// Pair of square panels.
			const side = Math.min(1.3, width * 0.42);
			return [-0.6, 0.6].map((share) => panel(share * side, 2.05, side * 0.86, side * 0.86));
		}
		case 'food':
			// Greenhouse glazing from sill to ceiling.
			return [panel(0, 1.95, width, 2.7)];
		case 'material':
			// Gate with an arched head on the ground, twin slots above.
			if (level === 0) {
				const gate = Math.min(1.9, width * 0.8);
				return [panel(0, 1.2, gate, 2.4), { kind: 'disc', along: 0, up: 2.4, radius: gate / 2 }];
			}
			return [-0.3, 0.3].map((share) => panel(share * width, 2.1, width * 0.22, 1.9));
	}
}

/** Wall frame of one cell side: middle of the wall, direction along it, outward normal. */
function wallFrame(cell: QuadCell, side: number, inset: number) {
	const a = cell.corners[side];
	const b = cell.corners[(side + 1) % 4];
	const length = sideLength(cell, side);
	const along: [number, number] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
	// Cells are counter-clockwise: the solid lies left of the side, outward is to the right.
	const outward: [number, number] = [along[1], -along[0]];
	const set = inset - RELIEF.proud;
	return {
		along,
		outward,
		middle: [(a[0] + b[0]) / 2 - outward[0] * set, (a[1] + b[1]) / 2 - outward[1] * set] as const
	};
}

function figureForm(figure: Figure, frame: ReturnType<typeof wallFrame>, floor: number): Form {
	const x = frame.middle[0] + frame.along[0] * figure.along;
	const y = frame.middle[1] + frame.along[1] * figure.along;
	const z = floor + figure.up;
	if (figure.kind === 'disc')
		return {
			kind: 'ring',
			position: [x, y, z],
			radius: figure.radius,
			innerRadius: 0,
			depth: RELIEF.depth,
			rotation: Math.atan2(frame.outward[1], frame.outward[0])
		};
	return {
		kind: 'box',
		position: [x - figure.width / 2, y - RELIEF.depth / 2, z - figure.height / 2],
		size: [figure.width, RELIEF.depth, figure.height],
		rotation: Math.atan2(frame.along[1], frame.along[0])
	};
}

/** True if a story of the neighbor cell covers the window band of this story. */
function isCovered(site: Site, neighborId: string, floor: number): boolean {
	const neighbor = site.grid.cellsById.get(neighborId);
	if (!neighbor) return false;
	return storiesOf(site.stacks, neighborId).some((_, level) => {
		const other = floorOf(neighbor, level);
		return other < floor + CLEAR_BAND.to && other + STORY > floor + CLEAR_BAND.from;
	});
}

function storyOpenings(site: Site, mass: Mass, story: Story, members: Set<string>, inset: number) {
	const { cell, level } = story;
	const floor = floorOf(cell, level);
	const isOuter = (side: number) => {
		const neighborId = cell.neighbors[side];
		return neighborId === null || !members.has(neighborId);
	};
	const isFree = (side: number) => {
		const neighborId = cell.neighbors[side];
		return isOuter(side) && (neighborId === null || !isCovered(site, neighborId, floor));
	};
	const parts: Primitive[] = [];
	for (let side = 0; side < 4; side++) {
		if (!isFree(side)) continue;
		if (hash(site.seed, cellKey(cell) * 64 + level * 4 + side, CHANNEL.opening) >= OPENING_SHARE)
			continue;
		// A wall that ends in a rounded corner has less free length than one in a straight run.
		const atCorner = isOuter((side + 1) % 4) || isOuter((side + 3) % 4);
		const width = sideLength(cell, side) * (atCorner ? WALL_SHARE.corner : WALL_SHARE.run);
		const frame = wallFrame(cell, side, wallMargin(site, mass, story, side, inset));
		const use = storiesOf(site.stacks, cell.id)[level] ?? mass.use;
		figures(use, level, width).forEach((figure, k) =>
			parts.push(
				detail(`${cell.id}@${level}:opening${side}.${k}`, use, figureForm(figure, frame, floor))
			)
		);
	}
	return parts;
}

/**
 * Openings of a mass. Deterministic per cell, level and side; a local edit elsewhere never
 * moves a window.
 */
export function openings(site: Site, mass: Mass, inset: number): Primitive[] {
	const members = new Set(mass.stories.map((story) => story.cell.id));
	return mass.stories.flatMap(({ cell, level }) =>
		Array.from({ length: massStoreys(mass) }, (_, offset) =>
			storyOpenings(site, mass, { cell, level: level + offset }, members, inset)
		).flat()
	);
}
