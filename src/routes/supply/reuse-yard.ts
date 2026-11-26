import type { Vec3 } from '../../lib/core/geometry';
import { projectFocus, type ViewFit } from '../../lib/scene/stage';
import { rectangle } from './district';
import { bayJoints, box, member } from './reuse-bay';

const yardHalfWidth = 10.5;
const yardHalfDepth = 6.4;
const railY = -3.5;
const railGauge = 2;
const railTop = 0.29;

export const yard = [
	box('yard/plinth', [0, 0, -0.71], [2 * yardHalfWidth, 2 * yardHalfDepth, 1.12], 'plinth'),
	box('yard/deck', [0, 0, -0.075], [2 * yardHalfWidth, 2 * yardHalfDepth, 0.15], 'yard'),
	...Array.from({ length: 13 }, (_, index) =>
		box(
			`guide-rail/sleeper/${index}`,
			[-9.6 + index * 1.6, railY, 0.065],
			[0.34, 2.75, 0.13],
			'frame'
		)
	),
	...[-railGauge / 2, railGauge / 2].map((offset, side) =>
		box(`guide-rail/rail/${side}`, [0, railY + offset, 0.21], [20.4, 0.19, 0.16], 'hardware')
	)
];

// The same model envelope and angles frame every reuse step.
const angles = { bearing: 0.34, elevation: 0.59 };
const deckCorners = rectangle(-yardHalfWidth, -yardHalfDepth, yardHalfWidth, yardHalfDepth);
export const yardFit: ViewFit = {
	...angles,
	fill: 0.91,
	subject: projectFocus('iso', angles, [
		...deckCorners.map(([x, y]): Vec3 => [x, y, -1.27]),
		[-8.8, 5.2, 6.15],
		[7.4, 4.8, 6.15]
	])
};

/** Building section with an adjacent enclosed bay and exposed mounting seats. */
export function building(id: string, socket: Vec3, state: 'open' | 'joined') {
	const [x, y, z] = socket;
	const joinRole = state === 'joined' ? 'material' : 'hardware';
	return [
		box(`${id}/adjacent-bay`, [x - 5.2, y + 1.85, 2.55], [4.2, 4.4, 5.1], 'cladding'),
		box(`${id}/roof`, [x - 1.9, y + 1.85, 5.3], [11, 4.7, 0.4], 'frame'),
		box(`${id}/foundation`, [x - 1.9, y + 1.75, z / 2], [10.9, 4.5, z], 'frame'),
		box(`${id}/rear-wall`, [x + 0.2, y + 3.6, 2.8], [5.4, 0.42, 4.95], 'cladding'),
		...[-3.14, 3.14].map((offset, side) =>
			box(`${id}/post/${side}`, [x + offset, y + 0.33, 2.86], [0.7, 0.85, 4.47], 'frame')
		),
		...bayJoints(socket).map(({ id: joint, point: [u, v, w] }) =>
			box(
				`${id}/${state}-socket/${joint}`,
				[u + Math.sign(u - x) * 0.62, v - 0.2, w],
				[0.63, 0.56, 0.67],
				joinRole
			)
		)
	];
}

export function cantileverHoist(id: string, [x, y, z]: Vec3) {
	const beamZ = 5.9;
	const hook: Vec3 = [x, y, z + 4.3];
	const postX = x + 3.55;
	return [
		box(`${id}/foot`, [postX, y + 0.55, 0.21], [1.45, 1.45, 0.42], 'frame'),
		box(`${id}/mast`, [postX, y + 0.55, beamZ / 2], [0.42, 0.48, beamZ], 'hardware'),
		box(`${id}/jib`, [x + 1.7, y + 0.55, beamZ], [4.22, 0.45, 0.36], 'hardware'),
		member(`${id}/brace`, [postX, y + 0.55, 4.65], [x + 2.1, y + 0.55, beamZ], 0.23, 'hardware'),
		member(`${id}/line`, [x, y + 0.55, beamZ], hook, 0.12, 'hardware'),
		box(`${id}/lifting-collar`, hook, [0.46, 0.48, 0.32], 'material'),
		...[-1.9, 1.9].map((offset, side) =>
			member(`${id}/sling/${side}`, hook, [x + offset, y, z + 3.69], 0.1, 'hardware')
		)
	];
}

export function depot([x, y, z]: Vec3) {
	return [
		box('depot/canopy', [x, y + 0.96, 5.02], [8, 2.78, 0.26], 'cladding'),
		box('depot/back-wall', [x, y + 2.1, 2.45], [7.7, 0.28, 4.9], 'timber'),
		...[-3.75, 3.75].flatMap((offset, side) => [
			box(`depot/post/${side}`, [x + offset, y - 0.17, 2.45], [0.38, 0.38, 4.9], 'hardware'),
			box(`depot/rack/${side}`, [x + offset * 0.59, y + 0.27, z / 2], [0.65, 1.77, z], 'frame')
		])
	];
}

export function railSled([x, , z]: Vec3) {
	return [
		box('rail-sled/deck', [x, railY, 0.65], [6.9, 3.15, 0.38], 'frame'),
		...[-railGauge / 2, railGauge / 2].map((offset, side) =>
			box(
				`rail-sled/guide-shoe/${side}`,
				[x, railY + offset, (railTop + 0.46) / 2],
				[5.4, 0.34, 0.46 - railTop],
				'hardware'
			)
		),
		...[-1.75, 1.75].flatMap((offset, side) => [
			box(
				`rail-sled/cradle/${side}`,
				[x + offset, railY, (0.84 + z) / 2],
				[0.57, 1.4, z - 0.84],
				'timber'
			),
			member(
				`rail-sled/brace/${side}`,
				[x + offset, railY + 1.28, 0.84],
				[x + offset, railY + 0.28, z + 1.35],
				0.19,
				'hardware'
			)
		])
	];
}

export function recoveryCrib([x, y, z]: Vec3) {
	const signX = x + 4.3;
	return [
		box('recovery/crib', [x, y + 0.05, z / 2], [6.7, 3.3, z], 'timber'),
		box('recovery/back-stop', [x, y + 1.55, 0.96], [6.7, 0.31, 0.82], 'frame'),
		box('recovery/sign-post', [signX, y, 1.02], [0.26, 0.32, 2.04], 'hardware'),
		...[-1, 1].map((slope) =>
			member(
				`recovery/cross/${slope}`,
				[signX - 0.62, y - 0.24, 2.02 - slope * 0.62],
				[signX + 0.62, y - 0.24, 2.02 + slope * 0.62],
				0.23,
				'signal'
			)
		)
	];
}
