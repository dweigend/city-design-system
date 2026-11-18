import type { Primitive, Vec3 } from '../parametrik/types';
import { TREE_FORM, type TreeProfile } from './proportions';

export type CrownForm = 'ball' | 'cone' | 'voxel' | 'spiral';
type CrownBase = Pick<Primitive, 'id' | 'role' | 'token' | 'material'>;
type Frame = { world: (u: number, v: number) => [number, number]; rot: number };
const worldFrame: Frame = { world: (x, y) => [x, y], rot: 0 };
const VOXELS = [
	[0, 0, 0],
	[1, 0, 0],
	[-1, 0, 0],
	[0, 1, 0],
	[0, -1, 0],
	[0, 0, 1]
];

/** Builds one crown above its base in meters. Supply metadata once per piece in draw order.
 * An optional frame maps local plan coordinates into world meters and rotates directional forms. */
export function crownParts(
	form: CrownForm,
	[u, v, z]: Vec3,
	s: number,
	base: (index: number) => CrownBase,
	frame: Frame = worldFrame,
	profile: TreeProfile = TREE_FORM
): Primitive[] {
	const at = (h: number): Vec3 => [...frame.world(u, v), h];
	switch (form) {
		case 'ball':
			return [
				{
					...base(0),
					kind: 'sphere',
					position: at(z + s * profile.ballRadius),
					radius: s * profile.ballRadius,
					squash: undefined
				}
			];
		case 'cone':
			return [
				{
					...base(0),
					kind: 'cone',
					position: at(z),
					radius: s * profile.coneRadius,
					height: s * profile.coneHeight
				}
			];
		case 'spiral':
			return [
				{
					...base(0),
					kind: 'helix',
					position: at(z),
					radius: s * 0.55,
					innerRadius: s * 0.12,
					height: s * 1.6,
					turns: 2.5,
					thickness: s * 0.16,
					rotation: frame.rot + 0
				}
			];
		case 'voxel': {
			const c = s * 0.45;
			return VOXELS.map(([du, dv, dz], i) => {
				// Transform the center of each local box around the frame origin.
				const [cx, cy] = frame.world(u + du * c - c / 2 + c / 2, v + dv * c - c / 2 + c / 2);
				return {
					...base(i),
					kind: 'box',
					position: [cx - c / 2, cy - c / 2, z + dz * c],
					size: [c, c, c],
					rotation: frame.rot
				};
			});
		}
	}
}
