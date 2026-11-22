import type { Vec3 } from '../parametrik/types';
import type { Kit } from './kit';
import { optional, type Lot } from './lot';

/**
 * Shell on a limb. `azimuth` is the plan angle in radians from +x; `reach` and `radius` are
 * shares of the plan module, `level` and `fork` shares of the height (shell centre, limb root).
 */
type Pod = { azimuth: number; reach: number; level: number; radius: number; fork: number };

/** Height to width of every shell: slightly pressed, like a pebble. */
const SQUASH = 0.82;
/** Height to width of a leaf crown. */
const LEAF_SQUASH = 0.34;
/** Plan direction toward the reader's view in radians; every opening turns to it. */
const FACING = -0.9;
const pods: readonly Pod[] = [
	{ azimuth: -0.62, reach: 0.92, level: 0.33, radius: 0.56, fork: 0.1 },
	{ azimuth: 2.6, reach: 0.9, level: 0.47, radius: 0.47, fork: 0.2 },
	{ azimuth: 0.85, reach: 0.86, level: 0.6, radius: 0.5, fork: 0.32 }
];

/**
 * Organic: one trunk forks into limbs that carry soft shells; moss grows on every shell and a
 * leaf canopy closes the top. The house has no storey line and no right angle.
 */
export function drawOrganic(kit: Kit, { width, height, complexity }: Lot) {
	const u = width / 3;
	const stem = (level: number): Vec3 => [
		0.22 * u * Math.sin(level * Math.PI * 1.3),
		0.2 * u - 0.25 * u * level,
		level * height
	];
	const crown = stem(0.8);
	const crownRadius = 0.44 * u;

	// Trunk: three lengths, each thinner than the one below.
	kit.pipe('limb', [stem(0), stem(0.08), stem(0.2), stem(0.34)], 0.24 * u);
	kit.pipe('limb', [stem(0.3), stem(0.45), stem(0.6)], 0.17 * u);
	kit.pipe('limb', [stem(0.56), stem(0.68), crown], 0.11 * u);
	kit.dome('limb', [stem(0)[0], stem(0)[1], 0], 0.42 * u, 0.16 * u);
	drawShell(kit, crown, crownRadius, FACING - 0.1, u);

	const centres = pods.map((pod): Vec3 => {
		const radius = pod.radius * u;
		const centre: Vec3 = [
			Math.cos(pod.azimuth) * pod.reach * u,
			Math.sin(pod.azimuth) * pod.reach * u,
			pod.level * height
		];
		const root = stem(pod.fork);
		const seat: Vec3 = [centre[0], centre[1], centre[2] - radius * SQUASH * 0.8];
		const elbow: Vec3 = [
			root[0] + (seat[0] - root[0]) * 0.78,
			root[1] + (seat[1] - root[1]) * 0.78,
			root[2] + (seat[2] - root[2]) * 0.34
		];
		kit.pipe('limb', [root, elbow, seat], (0.17 - pod.fork * 0.18) * u);
		drawShell(kit, centre, radius, FACING + (pod.azimuth > 2 ? -0.75 : 0.12), u);
		return centre;
	});

	// Ground shell with the entrance, grown from two domes.
	const den: Vec3 = [-0.62 * u, -0.78 * u, 0];
	kit.dome('shell', den, 0.66 * u, 0.56 * u);
	kit.dome('shell', [den[0] - 0.42 * u, den[1] + 0.5 * u, 0], 0.46 * u, 0.4 * u);
	const door: Vec3 = [den[0] + 0.47 * u, den[1] - 0.4 * u, 0.24 * u];
	kit.ring('collar', door, [0.3 * u, 0.2 * u, 0.3], FACING + 0.2, 0.4);
	kit.ring('pane', door, [0.2 * u, 0, 0.12], FACING + 0.2, 0.4);

	const extras = [
		() => {
			kit.ball('moss', [den[0], den[1], 0.5 * u], 0.36 * u, 0.4);
			kit.ball('moss', [crown[0], crown[1], crown[2] + crownRadius * SQUASH * 0.9], 0.3 * u, 0.4);
			pods.forEach((pod, i) =>
				kit.ball(
					'moss',
					[centres[i][0], centres[i][1], centres[i][2] + pod.radius * u * SQUASH * 0.9],
					pod.radius * u * 0.66,
					0.4
				)
			);
		},
		() => drawCanopy(kit, crown, height, u),
		() => {
			kit.ball('foliage', [0.95 * u, 0.85 * u, 0.3 * u], 0.36 * u, 0.9);
			kit.ball('foliage', [1.2 * u, 0.3 * u, 0.2 * u], 0.24 * u, 0.9);
			kit.ball('foliage', [0.5 * u, -1.05 * u, 0.2 * u], 0.24 * u, 0.9);
			kit.ball('foliage', [0.85 * u, -0.85 * u, 0.14 * u], 0.17 * u, 0.9);
			kit.ball('foliage', [-1.15 * u, 0.75 * u, 0.26 * u], 0.3 * u, 0.9);
		},
		() => {
			// Twigs: short side shoots that end in a bud.
			for (const [level, azimuth] of [
				[0.4, 3.9],
				[0.52, -0.2],
				[0.68, 2.2]
			]) {
				const root = stem(level);
				const bud: Vec3 = [
					root[0] + Math.cos(azimuth) * 0.62 * u,
					root[1] + Math.sin(azimuth) * 0.62 * u,
					root[2] + 0.42 * u
				];
				const bend: Vec3 = [(root[0] + bud[0]) / 2, (root[1] + bud[1]) / 2, root[2] + 0.1 * u];
				kit.pipe('limb', [root, bend, bud], 0.05 * u);
				kit.ball('moss', bud, 0.16 * u, 0.85);
			}
		}
	];
	for (const draw of optional(extras, complexity)) draw();
}

/** Pressed shell with a bud grown onto its far side and one round opening toward `azimuth`. */
function drawShell(kit: Kit, centre: Vec3, radius: number, azimuth: number, u: number) {
	kit.ball('shell', centre, radius, SQUASH);
	kit.ball(
		'shell',
		[
			centre[0] - Math.cos(azimuth - 0.7) * radius * 0.72,
			centre[1] - Math.sin(azimuth - 0.7) * radius * 0.72,
			centre[2] + radius * 0.22
		],
		radius * 0.62,
		SQUASH
	);
	const eye: Vec3 = [
		centre[0] + Math.cos(azimuth) * radius * 0.95,
		centre[1] + Math.sin(azimuth) * radius * 0.95,
		centre[2]
	];
	kit.ring('collar', eye, [0.48 * radius, 0.34 * radius, 0.09 * u], azimuth);
	kit.ring('pane', eye, [0.34 * radius, 0, 0.04 * u], azimuth);
}

/** Leaf canopy over the crown: pressed crowns on thin stalks, the highest at the top limit. */
function drawCanopy(kit: Kit, crown: Vec3, height: number, u: number) {
	const leaves: readonly [azimuth: number, reach: number, top: number, radius: number][] = [
		[2.6, 0.5, 1, 0.62],
		[0.5, 0.78, 0.93, 0.5],
		[-1.5, 0.62, 0.9, 0.4]
	];
	for (const [azimuth, reach, top, radius] of leaves) {
		const thickness = radius * u * LEAF_SQUASH;
		const leaf: Vec3 = [
			crown[0] + Math.cos(azimuth) * reach * u,
			crown[1] + Math.sin(azimuth) * reach * u,
			top * height - thickness
		];
		const bend: Vec3 = [(crown[0] + leaf[0]) / 2, (crown[1] + leaf[1]) / 2, leaf[2] - 0.5 * u];
		kit.pipe('limb', [crown, bend, leaf], 0.04 * u);
		kit.ball('foliage', leaf, radius * u, LEAF_SQUASH);
	}
}
