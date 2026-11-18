import { STORY } from '../../data/grid';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal } from '../traeger';
import type { Site } from './form';
import type { Mass } from './massing';
import { guest } from './megastructure-guests';
import { along, bayOf, mountingGrid, type Bay } from './megastructure-bay';

const TOTEM_DEFAULTS = {
	shoulder: 0.22,
	seat: 0.6,
	radius: 0.74,
	clearance: 0.31,
	glaze: 0.09,
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

/** A single glazed cartridge hangs from the carrier's crossbeam. */
export function dockedModule(b: Bay, side: number, p = TOTEM_DEFAULTS): Primitive[] {
	const end = (t: number) => along(b, side, t, 0.5, p.seat);
	const radius = Math.min(b.radius * p.radius, STORY * p.clearance);
	const crown = b.point(0.5, 0.5, p.seat);
	crown[2] += radius;
	return [
		b.piece('casting-seam', '--paper', {
			kind: 'polyline',
			points: castingSeam(end(p.shoulder), end(1 - p.shoulder), radius, p.seamSegments),
			closed: true
		}),
		{
			...b.piece('suspension', '--paper', {
				kind: 'polyline',
				points: [crown, b.point(0.5, 0.5, 1)]
			}),
			role: 'traeger',
			legacyRole: 'neu',
			member: 'secondary'
		},
		{
			...b.piece('module', '--paper', {
				kind: 'capsule',
				from: end(p.shoulder),
				to: end(1 - p.shoulder),
				radius
			}),
			edges: false,
			shade: p.glaze
		}
	];
}

/** A portal frame follows each cell side and carries one white ceramic module. */
export function totemMass(site: Site, mass: Mass, p = TOTEM_DEFAULTS): Primitive[] {
	const joints = mountingGrid(mass);
	return mass.stories.flatMap((story) => {
		const b = bayOf(mass, story, joints(story.cell));
		const side = kanal(site.seed, 'raumfachwerk', story.cell.id, 'module') % 4;
		const pier = (end: number) => [along(b, side, 0.5, end, 0), along(b, side, 0.5, end, 1)];
		return [
			{
				...b.piece('portal', '--paper', {
					kind: 'polyline',
					points: [...pier(0), ...pier(1).reverse()]
				}),
				role: 'traeger',
				bearings: [pier(0)[0], pier(1)[0]]
			},
			...dockedModule(b, side, p),
			...guest(b, mass.use, side, false)
		];
	});
}
