import type { Vec3 } from '../../lib/core/geometry';
import { squareSegment } from '../../lib/core/mesh';
import { Random } from '../../lib/core/random';
import type { Drawable } from '../../lib/scene/surface';

// The material flow uses the same token as the Interface palette.
const colors = {
	material: '--cat-living',
	frame: '--model-grey',
	cladding: '--model-cream',
	hardware: '--model-roof',
	plinth: '--ground-plinth',
	yard: '--model-ground',
	timber: '--model-cork',
	tag: '--model-white',
	signal: '--signal'
} as const;

type Role = keyof typeof colors;

export function box(id: string, center: Vec3, size: Vec3, role: Role): Drawable {
	return {
		id,
		shape: { kind: 'box', center, size, rotation: 0 },
		color: colors[role],
		finish: 'matte'
	};
}

export function member(id: string, from: Vec3, to: Vec3, width: number, role: Role): Drawable {
	return { id, shape: squareSegment(from, to, width), color: colors[role], finish: 'matte' };
}

// Precast bay dimensions and interface nodes in meters, relative to its sill datum.
const halfSpan = 2.45;
const lintelZ = 3.4;
const depth = 0.56;
const sillHeight = 0.64;
const jointZ = [sillHeight / 2, lintelZ] as const;

export function bayJoints([x, y, z]: Vec3) {
	return [-halfSpan, halfSpan].flatMap((offset, side) =>
		jointZ.map((height, level) => ({
			id: `${side}-${level}`,
			point: [x + offset, y, z + height] as Vec3
		}))
	);
}

export function facadeBay(id: string, origin: Vec3) {
	const [x, y, z] = origin;
	const jambWidth = 0.54;
	const jambHeight = lintelZ - sillHeight / 2;
	const span = 2 * halfSpan + jambWidth;
	return [
		box(id, [x, y, z + lintelZ], [span, depth, 0.58], 'material'),
		box(`${id}/sill`, [x, y, z + sillHeight / 2], [span, depth, sillHeight], 'material'),
		...[-halfSpan, halfSpan].map((offset, side) =>
			box(
				`${id}/jamb/${side}`,
				[x + offset, y, z + sillHeight / 2 + jambHeight / 2],
				[jambWidth, depth, jambHeight],
				'material'
			)
		),
		...bayJoints(origin).map(({ id: joint, point }) =>
			box(`${id}/flange/${joint}`, point, [1.03, 0.94, 0.8], 'material')
		)
	];
}

export function fracturedBay(id: string, [x, y, z]: Vec3, seed: number) {
	const drop = Random.create({ seed }).derive(id).number({ min: 0.67, max: 0.96 });
	const leftTop: Vec3 = [x - halfSpan, y, z + lintelZ];
	const rightTop: Vec3 = [x + halfSpan + 0.46, y - 0.48, z + lintelZ - drop];
	return [
		member(id, leftTop, [x - 0.55, y, z + lintelZ], 0.58, 'material'),
		member(
			`${id}/fracture/displaced-lintel`,
			[x + 0.25, y - 0.35, z + lintelZ - drop - 0.38],
			rightTop,
			0.58,
			'material'
		),
		member(`${id}/jamb/0`, [leftTop[0], y, z + 0.28], leftTop, 0.55, 'material'),
		member(`${id}/jamb/1`, [x + halfSpan, y, z + 0.28], rightTop, 0.55, 'material'),
		box(`${id}/sill`, [x, y, z + 0.28], [5.45, depth, 0.56], 'material'),
		box(`${id}/failed-flange`, rightTop, [0.8, 1.03, 0.66], 'signal')
	];
}
