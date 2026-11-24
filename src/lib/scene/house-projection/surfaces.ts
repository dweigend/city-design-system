import { defaults } from '../../../config/house-projection';
import type { Surface, SurfaceAssignment } from '../surface';

const { bodyStrokePx, detailStrokePx, bodyStrokeOpacity, detailStrokeOpacity, hiddenLineShare } =
	defaults;

const line = (color: `--${string}`, strong: boolean) => ({
	color,
	width: strong ? bodyStrokePx : detailStrokePx,
	opacity: strong ? bodyStrokeOpacity : detailStrokeOpacity,
	hidden: hiddenLineShare
});

const surface = (
	color: `--${string}`,
	stroke: `--${string}`,
	strong: boolean,
	finish: Surface['finish'] = 'matte'
): Surface => ({
	color,
	finish,
	stroke: line(stroke, strong)
});

const ground = {
	plot: surface('--paper-2', '--ink-3', false),
	court: surface('--cat-lawn', '--ink-2', false)
};

/** Full drawing by role slot, shared by every style (COLOR-3, COLOR-4, COLOR-8): white bodies and
 * shells with graphite lines, flat Memphis colour blocks, a grey hairline frame with colour only on
 * services, path pink on galleries and stairs, greens for planting. A house uses the slots it
 * declares. */
export const fullSurfaces = Object.freeze({
	...ground,
	wall: surface('--paper', '--ink', true),
	floorEdge: surface('--paper-3', '--ink-2', false),
	roofEdge: surface('--paper-2', '--ink-2', false),
	opening: surface('--ink-3', '--ink-2', false, 'glass'),
	gallery: surface('--path', '--ink', false),
	stair: surface('--path', '--ink', false),
	'body-white': surface('--paper', '--ink', true),
	'body-yellow': surface('--cat-mobility', '--ink', true),
	'body-blue': surface('--cat-health', '--ink', true),
	'body-red': surface('--signal', '--ink', true),
	'body-timber': surface('--terrain-soil', '--ink', true),
	'roof-blue': surface('--cat-health', '--ink', true),
	'roof-yellow': surface('--cat-mobility', '--ink', true),
	'roof-red': surface('--signal', '--ink', true),
	pattern: surface('--ink', '--ink', false),
	collar: surface('--ground-clay', '--ink-2', false),
	capsule: surface('--paper', '--ink-2', true),
	'capsule-accent': surface('--cat-mobility', '--ink-2', true),
	frame: surface('--ink-3', '--ink-2', false),
	deck: surface('--paper-3', '--ink-3', false),
	tube: surface('--cat-health', '--ink-2', false),
	mast: surface('--cat-mobility', '--ink-2', false),
	'body-shell': surface('--paper', '--ink-2', false),
	planter: surface('--cat-foliage', '--ink-2', false),
	foliage: surface('--cat-evergreen', '--ink-2', false),
	trunk: surface('--cat-bark', '--ink-2', false)
} satisfies SurfaceAssignment);

/** Block drawing: one white mass per built cell with strong lines. */
export const blockSurfaces = Object.freeze({
	...ground,
	mass: surface('--paper', '--ink', true)
} satisfies SurfaceAssignment);

/** Pencil drawing: pencil paper masses with graphite stock lines over plain ground (COLOR-5). */
export const pencilSurfaces = Object.freeze({
	plot: surface('--paper-2', '--stock-line', false),
	court: surface('--paper-2', '--stock-line', false),
	mass: surface('--stock-pencil', '--stock-line', true)
} satisfies SurfaceAssignment);

/** See-through drawing: veiled masses with graphite stock lines (COLOR-6). */
export const veilSurfaces = Object.freeze({
	...pencilSurfaces,
	mass: surface('--stock-veil', '--stock-line', true)
} satisfies SurfaceAssignment);
