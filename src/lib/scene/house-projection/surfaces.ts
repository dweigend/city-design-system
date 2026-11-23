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

/** Full drawing: white bodies with graphite lines, pale bands, dark panes, and the court access in
 * path pink (COLOR-3), on paper ground with a green court. */
export const fullSurfaces = Object.freeze({
	...ground,
	wall: surface('--paper', '--ink', true),
	floorEdge: surface('--paper-3', '--ink-2', false),
	roofEdge: surface('--paper-2', '--ink-2', false),
	opening: surface('--ink-3', '--ink-2', false, 'glass'),
	gallery: surface('--path', '--ink', false),
	stair: surface('--path', '--ink', false)
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
