/**
 * Land cover: the player plants areas, not objects. A cell carries at most one cover;
 * forests derive their trees from the cell, its neighbors and the seed.
 */
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';
import { hash } from '../hash-random';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';
import {
	TREE_FORM,
	trunkRadius,
	crownParts,
	type CrownForm,
	type TreeProfile
} from '../tree-forms';

/** Order is part of the contract: the scene maps the kinds to texture channels. */
export const COVER_KINDS = ['forest', 'field', 'meadow'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

/** Cover per cell id; a cell without cover has no entry. */
export type Cover = ReadonlyMap<string, CoverKind>;

/** Forest placement, tree size and canopy density controls for projected land cover. */
export const LAND_COVER_PARAMS = defineParams({
	// Add the seeded size range in meters to this minimum.
	treeSizeMin: numberParam('Minimum tree size', 'm', 1.9, [0.01, 30, 0.1]),
	treeSizeRange: numberParam('Tree size range', 'm', 1.9, [0, 30, 0.1]),
	cellMargin: numberParam('Cell margin', 'ratio', 0.16, [0, 0.5, 0.01]),
	lightTone: numberParam('Light tone', 'ratio', 0, [0, 1, 0.01]),
	middleTone: numberParam('Middle tone', 'ratio', 0.07, [0, 1, 0.01]),
	darkTone: numberParam('Dark tone', 'ratio', 0.14, [0, 1, 0.01])
});
const defaults = resolveParams(LAND_COVER_PARAMS);
/** Extra preference for conifers starts at `from` meters and reaches certainty at `to`. */
const CONIFER_RANGE = { from: 3, to: 20 };
const CHANNEL = { along: 21, across: 22, size: 23, kind: 24, tone: 25, form: 26 };

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

/** At low elevations the forest mixes crown forms. Higher sites favor cones. */
function forestForm(seed: number, id: number, z: number): CrownForm {
	const coniferShare = (z - CONIFER_RANGE.from) / (CONIFER_RANGE.to - CONIFER_RANGE.from);
	if (hash(seed, id, CHANNEL.kind) < coniferShare) return 'cone';
	const variety = hash(seed, id, CHANNEL.form);
	if (variety < 0.15) return 'voxel';
	if (variety < 0.3) return 'spiral';
	if (variety < 0.4) return 'cone';
	return 'ball';
}

function tree(
	seed: number,
	cell: QuadCell,
	slot: number,
	profile: typeof defaults,
	formProfile: TreeProfile
) {
	const id = cell.index * 4 + slot;
	const share = (channel: number) =>
		profile.cellMargin + hash(seed, id, channel) * (1 - 2 * profile.cellMargin);
	const [x, y, z] = cellPoint(cell, share(CHANNEL.along), share(CHANNEL.across));
	const s = profile.treeSizeMin + hash(seed, id, CHANNEL.size) * profile.treeSizeRange;
	const trunk = s * formProfile.trunkHeight * 0.5;
	const tones = [profile.lightTone, profile.middleTone, profile.darkTone];
	const shade = tones[Math.floor(hash(seed, id, CHANNEL.tone) * tones.length)];
	const form = forestForm(seed, id, z);
	const crown = crownParts(
		form,
		[x, y, z + (form === 'cone' ? trunk * 0.5 : trunk)],
		s,
		(i) => ({
			slot: 'foliage' as const,
			shade,
			id: i === 0 ? `${cell.id}:tree${slot}` : `${cell.id}:crown${slot}:${i}`
		}),
		undefined,
		formProfile
	);
	const stem = {
		slot: 'stem' as const,
		id: `${cell.id}:trunk${slot}`,
		shade: 0,
		kind: 'cylinder' as const,
		position: [x, y, z - 0.3] as Vec3,
		radius: trunkRadius(s, formProfile),
		height: trunk + s * formProfile.trunkIntoCrown + 0.3
	};
	return [stem, ...crown];
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
	seed: number,
	overrides?: ParamOverrides<typeof LAND_COVER_PARAMS>,
	formProfile: TreeProfile = TREE_FORM
) {
	const profile = overrides ? resolveParams(LAND_COVER_PARAMS, undefined, overrides) : defaults;
	return (grid.chunks.get(chunk) ?? []).flatMap((cell) => {
		if (cover.get(cell.id) !== 'forest') return [];
		const enclosed = cell.neighbors.every((id) => id !== null && cover.get(id) === 'forest');
		return enclosed
			? [...tree(seed, cell, 0, profile, formProfile), ...tree(seed, cell, 1, profile, formProfile)]
			: tree(seed, cell, 0, profile, formProfile);
	});
}
