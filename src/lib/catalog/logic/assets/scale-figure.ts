import type { Vec3 } from '../parametrik/types';
import { mount, type AssetRecipe } from './definition';
import type { ObjectGeometry } from './object-geometry';
import { bulb, surface } from './parts';

/** Standing, walking and pointing poses. The origin is at the soles, in metres. */
export function scaleFigure([x, y, z]: Vec3, pose: number, heading: number): ObjectGeometry[] {
	const point = (forward: number, side: number, up: number): Vec3 => [
		x + forward * Math.cos(heading) - side * Math.sin(heading),
		y + forward * Math.sin(heading) + side * Math.cos(heading),
		z + up
	];
	const limb = (from: Vec3, to: Vec3, radius: number): ObjectGeometry => ({
		...surface('figure'),
		kind: 'capsule',
		from,
		to,
		radius,
		detail: true,
		edges: false
	});
	const stride = pose === 1 ? 0.22 : 0.04;
	return [
		limb(point(0, -0.1, 0.81), point(stride, -0.12, 0.09), 0.09),
		limb(point(0, 0.1, 0.81), point(-stride, 0.12, 0.09), 0.09),
		limb(point(0, 0, 0.87), point(0.03, 0, 1.23), 0.205),
		limb(point(0.02, -0.18, 1.29), point(-stride, -0.23, 0.83), 0.072),
		limb(
			point(0.02, 0.18, 1.29),
			pose === 2 ? point(0.48, 0.22, 1.43) : point(stride, 0.24, 0.87),
			0.072
		),
		{ ...bulb(point(0.055, 0, 1.55), 0.145, 1.1, 'figure'), detail: true, edges: false }
	];
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
