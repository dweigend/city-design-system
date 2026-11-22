import type { Vec3 } from '../parametrik/types';
import { planen } from '../traeger';
import type { Kit } from './kit';
import { optional, type Lot } from './lot';

const LEVELS = 4;
/** Share of the height taken by the megastructure frame; the dome and the crane use the rest. */
const FRAME_SHARE = 0.64;

/**
 * Archigram and Fuller: a permanent open frame carries exchangeable capsules, the services
 * run outside, a geodesic dome caps the top deck and a crane keeps the plan unfinished.
 */
export function drawArchigram(kit: Kit, { width, height, complexity }: Lot) {
	const u = width / 3;
	const top = height * FRAME_SHARE;
	const lift = top / LEVELS;
	const radius = 0.31 * u;

	kit.lattice('frame', [-u, -u, 0], [2 * u, 2 * u, top], [2, 2, LEVELS], 0.2, true);
	kit.box('deck', [-u - 0.25, -u - 0.25, top], [2 * u + 0.5, 2 * u + 0.5, 0.24]);
	kit.box('deck', [-u, -u, 2 * lift - 0.2], [2 * u, 2 * u, 0.2]);
	drawDome(kit, [0.15 * u, -0.15 * u, top + 0.24], 0.84 * u);

	// Plugged units leave the frame on three sides, one per level.
	const side = lift + radius + 0.12;
	drawCapsule(
		kit,
		'capsule',
		[-0.5 * u, 0.5 * u, side],
		[1.62 * u - radius, 0.5 * u, side],
		radius
	);
	const front = 3 * lift + radius + 0.12;
	drawCapsule(kit, 'unit', [0.5 * u, 0.5 * u, front], [0.5 * u, -1.62 * u + radius, front], radius);
	const left = 2 * lift + radius + 0.12;
	drawCapsule(
		kit,
		'capsule',
		[0.5 * u, -0.5 * u, left],
		[-1.62 * u + radius, -0.5 * u, left],
		radius
	);

	const extras = [
		() => drawCrane(kit, [-0.55 * u, 0.7 * u, top + 0.24], height, u),
		() => {
			for (const y of [-0.62 * u, -0.38 * u])
				kit.pipe(
					'service',
					[
						[u + 0.38, y, 0],
						[u + 0.38, y, top + 0.8],
						[u + 0.15, y, top + 1.05],
						[0.55 * u, y, top + 1.05]
					],
					0.16
				);
		},
		() => {
			const foot: Vec3 = [-1.42 * u, -u - 0.6, 0.5];
			const head: Vec3 = [0.55 * u, -u - 0.6, 2 * lift + 0.45];
			kit.capsule('tube', foot, head, 0.46);
			kit.box('deck', [0.55 * u - 0.5, -u - 1.1, 2 * lift - 0.2], [1.2, 1.1, 0.2]);
		},
		() => {
			kit.capsule(
				'tank',
				[-0.5 * u, 0.5 * u, 2 * lift + 0.75],
				[-0.5 * u, 0.5 * u, 3 * lift - 0.9],
				0.3 * u
			);
			kit.pipe(
				'service',
				[
					[-0.5 * u, 0.5 * u, 3 * lift - 0.4],
					[-0.5 * u, 0.5 * u, top]
				],
				0.12
			);
		},
		() => {
			kit.box('deck', [-u, -u, lift - 0.2], [u, 2 * u, 0.2]);
			kit.drum('core', [-0.5 * u, -0.5 * u, 0], 0.34 * u, lift - 0.2);
		}
	];
	for (const draw of optional(extras, complexity)) draw();
}

/** Tube capsule between two points with collars and two portholes on its camera side. */
function drawCapsule(kit: Kit, slot: string, from: Vec3, to: Vec3, radius: number) {
	kit.capsule(slot, from, to, radius);
	const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]);
	const at = (t: number): Vec3 => [
		from[0] + (to[0] - from[0]) * t,
		from[1] + (to[1] - from[1]) * t,
		from[2] + (to[2] - from[2]) * t
	];
	for (const t of [0.34, 0.72]) {
		const [x, y, z] = at(t);
		const eye: Vec3 = alongX ? [x, y - radius + 0.03, z] : [x + radius - 0.03, y, z];
		kit.ring('port', eye, [0.46 * radius, 0.3 * radius, 0.2], alongX ? Math.PI / 2 : 0);
		kit.ring('pane', eye, [0.3 * radius, 0, 0.12], alongX ? Math.PI / 2 : 0);
	}
	for (const t of [0.12, 0.53, 0.94])
		kit.ring('port', at(t), [radius + 0.07, radius - 0.05, 0.12], alongX ? 0 : Math.PI / 2);
}

/** Class-I geodesic from the dome carrier family, scaled to `radius` metres on `base`. */
function drawDome(kit: Kit, base: Vec3, radius: number) {
	const plan = planen('kuppel', { frequenz: 2 });
	const scale = radius / plan.werte.radius;
	const index = new Map(plan.knoten.map((node, i) => [node.id, i]));
	const points = plan.knoten.map(({ p }): Vec3 => [
		base[0] + p[0] * scale,
		base[1] + p[1] * scale,
		base[2] + p[2] * scale
	]);
	const at = (id: string) => points[index.get(id) ?? 0];
	const triangles = plan.flaechen
		.filter((face) => face.rolle !== 'boden')
		.flatMap((face) => {
			const ring = face.knoten.map((id) => index.get(id) ?? 0);
			return ring.slice(2).flatMap((corner, i) => [ring[0], ring[i + 1], corner]);
		});
	kit.mesh('glazing', points, triangles);
	kit.bars(
		'strut',
		plan.kanten.map((edge): [Vec3, Vec3] => [at(edge.a), at(edge.b)]),
		0.1
	);
}

/** Tower crane on `foot`: lattice mast, jib to the right with a hung capsule, counter-jib behind. */
function drawCrane(kit: Kit, foot: Vec3, height: number, u: number) {
	const [x, y, z] = foot;
	const head = height - 0.6;
	const reach: Vec3 = [x + 2.55 * u, y - 0.55 * u, head];
	const back: Vec3 = [x - 0.6 * u, y + 0.13 * u, head];
	kit.lattice('crane', [x - 0.25, y - 0.25, z], [0.5, 0.5, head - z], [1, 1, 5], 0.1, true);
	kit.bars(
		'crane',
		[
			[back, reach],
			[[x, y, height], reach],
			[[x, y, height], back],
			[
				[x, y, head],
				[x, y, height]
			]
		],
		0.13
	);
	kit.box('core', [back[0] - 0.35, back[1] - 0.35, head - 0.6], [0.7, 0.7, 0.55]);
	const hook: Vec3 = [x + 2.3 * u, y - 0.5 * u, head];
	const load = head - 0.27 * height;
	kit.bars('core', [[hook, [hook[0], hook[1], load + 0.5]]], 0.05);
	drawCapsule(
		kit,
		'unit',
		[hook[0], hook[1] + 0.3 * u, load],
		[hook[0], hook[1] - 0.3 * u, load],
		0.5
	);
}
