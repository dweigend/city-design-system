import { BODY_TOKEN } from './body-token';
import { storiesOf } from './stacks';
import { required } from '../required';
import { ceramicFitting } from './ceramic-fitting';
import type { ModuleRecipe } from './module-group';
import type { DockedModule } from '../megastructure';
import { flowToken } from '../../data/focus';
import { STORY } from '../../data/grid';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal } from '../traeger';
import type { Site } from './form';
import type { Mass } from './massing';
import { guest } from './megastructure-guests';
import { along, bayOf, mountingGrid, type Bay } from './megastructure-bay';

const TOTEM_DEFAULTS = {
	shoulder: 0.15,
	seat: 0.5,
	radius: 0.74,
	clearance: 0.42,
	seamSegments: 8
};

// The horizontal joint follows both hemispherical ends of the slip-cast shell.
function castingSeam(from: Vec3, to: Vec3, radius: number, segments: number): Vec3[] {
	const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
	return [to, from].flatMap((center, end) =>
		Array.from({ length: segments + 1 }, (_, i): Vec3 => {
			const turn = angle + Math.PI * (end + i / segments - 0.5);
			return [center[0] + radius * Math.cos(turn), center[1] + radius * Math.sin(turn), center[2]];
		})
	);
}

type Pod = Extract<Primitive, { kind: 'capsule' }>;

function porthole(b: Bay, pod: Pod): Primitive[] {
	const { from, to, radius } = pod;
	const turn = Math.atan2(to[1] - from[1], to[0] - from[0]);
	const position: Vec3 = [to[0] + radius * Math.cos(turn), to[1] + radius * Math.sin(turn), to[2]];
	const outer = Math.min(0.45, radius * 0.9);
	const ring = {
		kind: 'ring',
		position,
		rotation: turn,
		radius: outer,
		curvature: radius
	} as const;
	return [
		{
			...b.piece('module/porthole-ring', '--ink', {
				...ring,
				innerRadius: outer * 0.8,
				depth: 0.05
			}),
			material: 'concrete'
		},
		{
			...b.piece('module/porthole-pane', '--paper', {
				...ring,
				radius: outer * 0.8,
				innerRadius: 0,
				depth: 0.03
			}),
			material: 'concrete'
		}
	];
}

/** Detached printed pod and hanger in metres, aligned with the given bay side (0–3). */
export function dockedModule(
	b: Bay,
	side: number,
	token: Primitive['token'],
	p = TOTEM_DEFAULTS
): Primitive[] {
	const center = b.point(0.5, 0.5, p.seat);
	const turn = (side * Math.PI) / 2;
	const end = (t: number): Vec3 => {
		const [a, d] = along(b, side, t, 0.5, p.seat);
		const reach = Math.sign(t - 0.5) * Math.hypot(a - center[0], d - center[1]);
		return [center[0] + reach * Math.cos(turn), center[1] + reach * Math.sin(turn), center[2]];
	};
	const radius = Math.min(b.radius * p.radius, STORY * p.clearance);
	const pod: Pod = {
		...b.piece('module', token, {
			kind: 'capsule',
			from: end(p.shoulder),
			to: end(1 - p.shoulder),
			radius
		}),
		material: 'concrete',
		envelope: true,
		edges: false,
		shade: 0,
		printBand: { heightShare: 0.62, upper: '--paper' }
	};
	const crown: Vec3 = [center[0], center[1], center[2] + radius];
	return [
		{
			...b.piece('suspension', '--ink', {
				kind: 'polyline',
				points: [crown, b.point(0.5, 0.5, 1)]
			}),
			role: 'traeger',
			sectionDiameter: 0.12
		},
		pod,
		...porthole(b, pod)
	];
}

/** One pencil portal and printed pod per story, ordered by the mass's cell order. */
export function totemMass(site: Site, mass: Mass, p = TOTEM_DEFAULTS): Primitive[] {
	const joints = mountingGrid(mass);
	const baseSide = kanal(site.seed, 'raumfachwerk', 'town', 'module') % 4;
	const roof = mass.stories.find(
		({ cell, level }) => storiesOf(site.stacks, cell.id).length === level + 1
	);
	return mass.stories.flatMap((story) => {
		const b = bayOf(mass, story, joints(story.cell));
		const side = (baseSide + (story.level % 2)) % 4;
		const pier = (end: number) => [along(b, side, 0.5, end, 0), along(b, side, 0.5, end, 1)];
		return [
			{
				...b.piece('portal', '--ink', {
					kind: 'polyline',
					points: [...pier(0), ...pier(1).reverse()]
				}),
				role: 'traeger',
				sectionDiameter: 0.12,
				bearings: [pier(0)[0], pier(1)[0]]
			},
			...dockedModule(b, side, BODY_TOKEN[mass.use], p),
			...(story === roof ? guest(b, mass.use, side, true, STORY) : [])
		];
	});
}

/** Projects a K2 module in its solved socket basis, meters. */
function dockedForms(
	id: string,
	recipe: Exclude<ModuleRecipe, 'ceramic'>,
	m: DockedModule
): Primitive[] {
	const [x, y, z] = m.center;
	const b = { id, role: 'neu', material: 'glaze', token: '--paper' } as const;

	if (recipe === 'tank')
		return [
			{
				...b,
				kind: 'sphere',
				fine: true,
				position: m.center,
				radius: m.size[0] / 2,
				token: flowToken.water
			}
		];
	if (recipe === 'solar-ring')
		return [
			{
				...b,
				kind: 'torus',
				axis: 'z',
				position: m.center,
				radius: (m.size[0] - m.size[2]) / 2,
				tube: m.size[2] / 2,
				token: flowToken.energy
			}
		];
	if (recipe === 'capsule') {
		const radius = m.size[1] / 2,
			half = (m.size[0] - m.size[1]) / 2;
		const tip = (sign: number): Vec3 => [
			x + sign * half * m.tangent[0],
			y + sign * half * m.tangent[1],
			z
		];
		const from = tip(-1),
			to = tip(1);
		return [
			{ ...b, kind: 'capsule', from, to, radius },
			{
				...b,
				id: id + '/seam',
				kind: 'polyline',
				points: castingSeam(from, to, radius, TOTEM_DEFAULTS.seamSegments),
				closed: true,
				detail: true
			}
		];
	}
	const [w, d, h] = m.size;
	const token = {
		access: '--cat-business-3',
		garden: '--cat-nature-2',
		workshop: flowToken.material
	} as const;
	return [
		{
			...b,
			kind: 'box',
			position: [x - w / 2, y - d / 2, z - h / 2],
			rotation: Math.atan2(m.tangent[1], m.tangent[0]),
			size: m.size,
			token: token[recipe]
		}
	];
}

/** Projects all solids belonging to one removable shell, including the function fitting. */
export function shellForms(
	id: string,
	recipe: ModuleRecipe,
	seat: { shell: DockedModule; accent?: DockedModule; profileSeed?: number; contactRing?: number },
	coarse = false
) {
	const shell = dockedForms(id, 'capsule', seat.shell);
	if (recipe === 'ceramic' && seat.accent)
		return [
			...shell,
			...ceramicFitting(
				id + '/fitting',
				seat.accent,
				required(seat.profileSeed, 'casting seed'),
				coarse,
				required(seat.contactRing, 'contact section')
			)
		];
	return seat.accent && recipe !== 'ceramic'
		? [...shell, ...dockedForms(id + '/fitting', recipe, seat.accent)]
		: shell;
}
