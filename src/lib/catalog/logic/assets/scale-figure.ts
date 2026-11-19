import type { Vec3 } from '../parametrik/types';
import { mount, type AssetRecipe } from './definition';
import type { ObjectGeometry } from './object-geometry';
import { actionFigure } from './production/activities/action-figure';

/** Places the shared architectural figure at sole height, using the public figure slot. */
export function scaleFigure(origin: Vec3, pose: number, heading: number): ObjectGeometry[] {
	const posture = (['stand', 'walk', 'lean'] as const)[pose] ?? 'stand';
	return actionFigure(posture, origin, { heading, slot: 'figure' }).map((part) => ({
		...part,
		detail: true,
		edges: false
	}));
}

export const scaleFigureAsset: AssetRecipe = {
	id: 'scale-figure',
	category: 'street-furniture',
	variants: ['standing', 'walking', 'pointing'],
	footprint: [1.2, 1.2],
	anchors: [mount('deck')],
	slotNames: ['figure'],
	draw: (variant, sample) => scaleFigure([0, 0, 0], variant, (sample - 0.5) * Math.PI)
};
