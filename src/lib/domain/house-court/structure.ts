import type { Vec2, Vec3 } from '../../core/geometry';
import type { Part } from '../../core/object';
import { defaults } from '../../../config/house-court';
import { cellCentre, type FineCell } from '../cell-space';
import { faceMesh, side } from './boxes';
import { builtAt, type Context } from './context';
import { bar, extrusion, inset, rounded, type Faces } from './solids';

const { archigramBarM, archigramTubeRadiusM, frameDeckThicknessM, mastBarM } = defaults;

const part = (id: string, slot: string, faces: Faces): Part[] => {
	const shape = faceMesh(faces);
	return shape ? [{ id, slot, shape }] : [];
};
// Exact arithmetic: structural counts, switches, origins and unit axes, not tunables.
const key = ([x, y, z]: Vec3) => [x, y, z].map((v) => v.toFixed(3)).join(',');
const level = ({ space }: Context, storey: number) => space.baseZ + storey * space.storeyHeightM;

function eachBuilt(ctx: Context, visit: (cell: FineCell, from: number, to: number) => void) {
	for (const cell of ctx.space.cells) {
		const house = ctx.occupancy.get(cell.id);
		if (house && house.toStorey > house.fromStorey) visit(cell, house.fromStorey, house.toStorey);
	}
}

/** The exposed frame on the cell edges (FORM-6): posts from the ground to the top of each built
 * run, beams on every storey line, and diagonals on a share of the exposed bays. Shared members
 * are emitted once. */
// Exact arithmetic: structural counts, switches, origins and unit axes, not tunables.
function frame(ctx: Context): Faces {
	const members = new Map<string, Faces>();
	const add = (a: Vec3, b: Vec3) => {
		const id = [key(a), key(b)].sort().join('>');
		if (!members.has(id)) members.set(id, bar(a, b, archigramBarM));
	};
	const brace = ctx.style.parts.braceShareRatio * ctx.complexity;
	eachBuilt(ctx, (cell, from, to) => {
		const at = ([x, y]: Vec2, storey: number): Vec3 => [x, y, level(ctx, storey)];
		cell.quad.forEach((corner, i) => {
			const next = cell.quad[(i + 1) % cell.quad.length];
			add(at(corner, 0), at(corner, to));
			for (let storey = from; storey <= to; storey += 1) add(at(corner, storey), at(next, storey));
			for (let storey = from; storey < to; storey += 1)
				if (
					!builtAt(ctx, cell.sides[i].neighbour, storey) &&
					ctx.random.derive(`${cell.id}/brace/${i}/${storey}`).number() < brace
				)
					add(at(corner, storey), at(next, storey + 1));
		});
	});
	return [...members.values()].flat();
}

/** A thin deck under every framed storey of every built cell. */
function decks(ctx: Context): Faces {
	const faces: Faces = [];
	eachBuilt(ctx, (cell, from, to) => {
		const plate = inset(cell.quad, archigramBarM / 2);
		for (let storey = Math.max(1, from); storey <= to; storey += 1)
			faces.push(...extrusion(plate, level(ctx, storey) - frameDeckThicknessM, level(ctx, storey)));
	});
	return faces;
}

/** Service tubes at a share of the outer cell corners, inside their cells, rising past the top. */
// Exact arithmetic: structural counts, switches, origins and unit axes, not tunables.
function tubes(ctx: Context): Faces {
	const share = ctx.style.parts.tubeShareRatio * ctx.complexity;
	const faces: Faces = [];
	eachBuilt(ctx, (cell, _, to) => {
		cell.sides.forEach(({ neighbour }, i) => {
			if (neighbour !== null || ctx.random.derive(`${cell.id}/tube/${i}`).number() >= share) return;
			const wall = side(cell.quad, i);
			const [x, y] = wall.at(1 / 2, -(archigramTubeRadiusM + archigramBarM));
			const ring = rounded(
				[
					[x - archigramTubeRadiusM, y - archigramTubeRadiusM],
					[x + archigramTubeRadiusM, y - archigramTubeRadiusM],
					[x + archigramTubeRadiusM, y + archigramTubeRadiusM],
					[x - archigramTubeRadiusM, y + archigramTubeRadiusM]
				],
				0,
				archigramTubeRadiusM * (1 - 1 / 8)
			);
			faces.push(...extrusion(ring, ctx.space.baseZ, level(ctx, to) + ctx.space.storeyHeightM / 2));
		});
	});
	return faces;
}

/** A mast on the tallest built cell, inside its storey span above the roof. */
// Exact arithmetic: structural counts, switches, origins and unit axes, not tunables.
function mast(ctx: Context): Faces {
	const storeys = ctx.style.parts.mastStoreys;
	if (!storeys) return [];
	let best: { cell: FineCell; to: number } | undefined;
	eachBuilt(ctx, (cell, _, to) => {
		if (!best || to > best.to) best = { cell, to };
	});
	if (!best || best.to + storeys > ctx.space.storeyCount) return [];
	const [x, y] = cellCentre(best.cell);
	const base = level(ctx, best.to);
	const top = level(ctx, best.to + storeys);
	const arm = side(best.cell.quad, 0).length / 4;
	return [
		...bar([x, y, base], [x, y, top], mastBarM * 2),
		...bar([x - arm, y, top - mastBarM * 4], [x + arm, y, top - mastBarM * 4], mastBarM),
		...bar([x, y - arm, top - mastBarM * 8], [x, y + arm, top - mastBarM * 8], mastBarM)
	];
}

/** Structure and services of a framed style: frame, decks, tubes and mast, one mesh per kind. */
export function structure(ctx: Context): Part[] {
	if (!ctx.style.parts.frame) return [];
	const id = ctx.space.id;
	return [
		...part(`${id}/frame`, 'frame', frame(ctx)),
		...part(`${id}/decks`, 'deck', decks(ctx)),
		...part(`${id}/tubes`, 'tube', tubes(ctx)),
		...part(`${id}/mast`, 'mast', mast(ctx))
	];
}
