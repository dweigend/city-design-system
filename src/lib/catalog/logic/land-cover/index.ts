/**
 * Land cover: the player plants areas, not objects. A cell carries at most one cover;
 * forests derive their trees from the cell, its neighbors and the seed.
 */
import { hash } from '../hash-random';
import type { Primitive, Vec3 } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';
import { TREE_FORM, trunkRadius } from '../tree-forms';

/** Order is part of the contract: the scene maps the kinds to texture channels. */
export const COVER_KINDS = ['forest', 'field', 'meadow'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

/** Cover per cell id; a cell without cover has no entry. */
export type Cover = ReadonlyMap<string, CoverKind>;

/** Tree size in meters: smallest tree and the seeded range on top of it. */
const TREE_SIZE = { min: 1.9, range: 1.9 };
/** Share of the cell a tree keeps clear of the cell sides. */
const CELL_MARGIN = 0.16;
/** Conifers take over with height: none at `from` meters above the water, all at `to`. */
const CONIFER_RANGE = { from: 3, to: 20 };
const TONE_STEPS = [0, 0.07, 0.14];
const CHANNEL = { along: 21, across: 22, size: 23, kind: 24, tone: 25 };

/**
 * Sets or clears the cover of a cell. Returns a new map, or the input if nothing changes.
 * @param kind undefined clears the cell
 */
export function setCover(cover: Cover, cellId: string, kind: CoverKind | undefined): Cover {
	if (cover.get(cellId) === kind) return cover;
	const next = new Map(cover);
	if (kind) next.set(cellId, kind);
	else next.delete(cellId);
	return next;
}

/** Point of a cell at shares (u, v) of its sides, bilinear over the corners. */
function cellPoint(cell: QuadCell, u: number, v: number): Vec3 {
	const [a, b, c, d] = cell.corners;
	const mix = (k: 0 | 1 | 2) =>
		(a[k] * (1 - u) + b[k] * u) * (1 - v) + (d[k] * (1 - u) + c[k] * u) * v;
	return [mix(0), mix(1), mix(2)];
}

function tree(seed: number, cell: QuadCell, slot: number): Primitive[] {
	const id = cell.index * 4 + slot;
	const share = (channel: number) => CELL_MARGIN + hash(seed, id, channel) * (1 - 2 * CELL_MARGIN);
	const [x, y, z] = cellPoint(cell, share(CHANNEL.along), share(CHANNEL.across));
	const s = TREE_SIZE.min + hash(seed, id, CHANNEL.size) * TREE_SIZE.range;
	const trunk = s * TREE_FORM.trunkHeight * 0.5;
	const shade = TONE_STEPS[Math.floor(hash(seed, id, CHANNEL.tone) * TONE_STEPS.length)];
	const common = { role: 'neu', material: 'wood', shade } as const;
	const coniferShare = (z - CONIFER_RANGE.from) / (CONIFER_RANGE.to - CONIFER_RANGE.from);
	const conifer = hash(seed, id, CHANNEL.kind) < coniferShare;
	const crown: Primitive = conifer
		? {
				...common,
				id: `${cell.id}:tree${slot}`,
				token: '--cat-nature',
				kind: 'cone',
				position: [x, y, z + trunk * 0.5],
				radius: s * TREE_FORM.coneRadius,
				height: s * TREE_FORM.coneHeight
			}
		: {
				...common,
				id: `${cell.id}:tree${slot}`,
				token: '--cat-nature',
				kind: 'sphere',
				position: [x, y, z + trunk + s * TREE_FORM.ballRadius],
				radius: s * TREE_FORM.ballRadius
			};
	const stem: Primitive = {
		...common,
		id: `${cell.id}:trunk${slot}`,
		token: '--paper',
		shade: 0,
		kind: 'cylinder',
		position: [x, y, z - 0.3],
		radius: trunkRadius(s),
		height: trunk + s * TREE_FORM.trunkIntoCrown + 0.3
	};
	return [stem, crown];
}

/**
 * Trees of the forest cells of one chunk, in the shared render contract. A cell inside the
 * forest carries two trees, a cell at its edge one: the edge thins out.
 * @param chunk chunk identity of the grid's cells
 * @returns detached primitives in world meters
 */
export function forestChunk(
	grid: QuadGrid,
	cover: Cover,
	chunk: string,
	seed: number
): Primitive[] {
	return (grid.chunks.get(chunk) ?? []).flatMap((cell) => {
		if (cover.get(cell.id) !== 'forest') return [];
		const enclosed = cell.neighbors.every((id) => id !== null && cover.get(id) === 'forest');
		return enclosed ? [...tree(seed, cell, 0), ...tree(seed, cell, 1)] : tree(seed, cell, 0);
	});
}
