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
	plot: surface('--model-ground', '--ink-3', false),
	court: surface('--cat-lawn', '--ink-2', false)
};

/** Full drawing by role slot, shared by every style: model bodies in default tones that a
 * style row's materials override per house (MAT-10, MAT-11), dark plain openings (MAT-12), path
 * pink on galleries and stairs (COLOR-3), greens for planting and the services in their flow
 * colours. A house uses the slots it declares. */
export const fullSurfaces = Object.freeze({
	...ground,
	wall: surface('--model-cream', '--ink', true),
	mass: surface('--model-cream', '--ink', true),
	rim: surface('--model-cream', '--ink', true),
	opening: surface('--model-hole', '--ink-2', false),
	gallery: surface('--path', '--ink', false),
	stair: surface('--path', '--ink', false),
	accent: surface('--model-orange', '--ink', true),
	roof: surface('--model-roof', '--ink', true),
	'body-main': surface('--model-blue', '--ink', true),
	'body-second': surface('--model-cork', '--ink', true),
	collar: surface('--model-white', '--ink-2', false),
	capsule: surface('--model-white', '--ink-2', true),
	'capsule-accent': surface('--model-yellow', '--ink-2', true),
	frame: surface('--ink-3', '--ink-2', false),
	deck: surface('--paper-3', '--ink-3', false),
	tube: surface('--cat-health', '--ink-2', false),
	mast: surface('--cat-mobility', '--ink-2', false),
	'body-shell': surface('--model-cream', '--ink-2', false),
	planter: surface('--cat-foliage', '--ink-2', false),
	foliage: surface('--cat-evergreen', '--ink-2', false),
	trunk: surface('--cat-bark', '--ink-2', false)
} satisfies SurfaceAssignment);

/** Block drawing: one white mass per built cell with strong lines. */
export const blockSurfaces = Object.freeze({
	...ground,
	frame: fullSurfaces.frame,
	mass: surface('--paper', '--ink', true)
} satisfies SurfaceAssignment);

/** Pencil drawing: pencil paper masses with graphite stock lines over plain ground (COLOR-5). */
export const pencilSurfaces = Object.freeze({
	plot: surface('--paper-2', '--stock-line', false),
	court: surface('--paper-2', '--stock-line', false),
	frame: surface('--stock-pencil', '--stock-line', false),
	mass: surface('--stock-pencil', '--stock-line', true)
} satisfies SurfaceAssignment);

/** See-through drawing: veiled masses with graphite stock lines (COLOR-6). */
export const veilSurfaces = Object.freeze({
	...pencilSurfaces,
	mass: surface('--stock-veil', '--stock-line', true)
} satisfies SurfaceAssignment);
