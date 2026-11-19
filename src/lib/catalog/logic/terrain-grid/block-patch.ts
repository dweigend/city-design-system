import { planCourts } from './plan-courts';
import { fitPatch, type FittedPatch } from './fit-patch';
import { editReach, type TerrainEdit } from '../terrain';
import { hash } from '../hash-random';
import { BLOCK, type Lattice } from './contour-rows';
import { settlementExtent } from './alley-plan';
import { cellId } from './types';
import type { Ground } from './block-faces';

type CachedBlock = {
	patch: ReturnType<typeof planCourts>;
	templates: Map<string, FittedPatch['template']>;
	bounds: number[];
};
export type BlockCache = Map<string, CachedBlock>;

function buildBlock(
	lattice: Lattice,
	ground: Ground,
	x: number,
	y: number,
	width: number,
	height: number,
	old?: CachedBlock
): CachedBlock {
	const points = Array.from({ length: (width + 1) * (height + 1) }, (_, i) =>
		ground(x + (i % (width + 1)), y + Math.floor(i / (width + 1)))
	);
	const seed = Math.floor(hash(lattice.terrain.seed, y * lattice.columns + x, 0) * 0xffffffff);
	const settled =
		settlementExtent(lattice.terrain, x + BLOCK.columns / 2, y + BLOCK.rows / 2, lattice.profile) >
		0;
	const templates = new Map<string, FittedPatch['template']>();
	const patch = planCourts(lattice, x, y, (allowed) => {
		const key = [...allowed].join(';');
		const result = fitPatch(
			width,
			height,
			seed,
			lattice,
			(c, r) => points[r * (width + 1) + c],
			settled,
			allowed,
			old?.templates.get(key)
		);
		templates.set(key, result.template);
		return result;
	});
	const xs = points.map((p) => p[0]),
		ys = points.map((p) => p[1]);
	return {
		patch,
		templates,
		bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
	};
}

/** Fits the Universal kernel's relaxed patches inside fixed alley bands, including partial rim blocks. */
export function blockPatches(
	lattice: Lattice,
	ground: Ground,
	cache: BlockCache,
	unchanged: (x: number, y: number, width: number, height: number) => boolean,
	edits: readonly TerrainEdit[] = []
) {
	const patches = new Map<string, { patch: CachedBlock['patch']; reused: boolean }>();
	return (c: number, r: number) => {
		const x = Math.floor(Math.min(c, lattice.columns - 1) / BLOCK.columns) * BLOCK.columns;
		const y = Math.floor(Math.min(r, lattice.rows - 1) / BLOCK.rows) * BLOCK.rows;
		const key = cellId(x, y);
		let entry = patches.get(key);
		if (!entry) {
			const width = Math.min(BLOCK.columns, lattice.columns - x);
			const height = Math.min(BLOCK.rows, lattice.rows - y);

			const old = cache.get(key);
			if (
				old &&
				unchanged(x, y, width, height) &&
				!edits.some((edit) => {
					const { center } = edit;
					const [left, bottom, right, top] = old.bounds;
					return (
						Math.hypot(
							Math.max(left - center[0], 0, center[0] - right),
							Math.max(bottom - center[1], 0, center[1] - top)
						) <= editReach(edit)
					);
				})
			) {
				entry = { patch: old.patch, reused: true };
			} else {
				const built = buildBlock(lattice, ground, x, y, width, height, old);
				cache.set(key, built);
				const patch = built.patch;
				entry = { patch, reused: false };
			}
			patches.set(key, entry);
		}
		return { patch: entry.patch, reused: entry.reused, x, y, id: cellId(c - x, r - y) };
	};
}
