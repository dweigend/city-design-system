import { buildVessel, vesselMeshes } from '../art-reference';
import type { DockedModule } from '../megastructure';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal } from '../traeger';

/** Seats a slip-cast inlet on the surveyed chord with the water color confined to its mouth. */
export function ceramicFitting(id: string, fitting: DockedModule): Primitive[] {
	const seed = kanal(0, 'raumfachwerk', id, 'ceramic-profile');
	const v = buildVessel(
		[
			[-2, -2],
			[2, -2],
			[2, 2],
			[-2, 2]
		],
		seed,
		{ lobes: 1 + (seed % 2), height: 2.5 }
	);
	if (!v) throw new Error('Missing ceramic socket profile');
	const scale = Math.min(
		1.6 / v.base.radius,
		fitting.size[0] / (2 * Math.max(...v.rings.map((r) => r.outer + Math.abs(r.offset)))),
		fitting.size[2] / v.rings[v.rings.length - 1].z
	);
	const origin: Vec3 = [
		fitting.center[0],
		fitting.center[1],
		fitting.center[2] - fitting.size[2] / 2
	];
	const { body, lip } = vesselMeshes(
		v,
		origin,
		Math.atan2(fitting.tangent[1], fitting.tangent[0]) + v.base.angle,
		scale
	);
	const base = { role: 'neu', material: 'glaze', shade: 0 } as const;
	return [
		{ ...body, ...base, id, token: '--paper' },
		{ ...lip, ...base, id: id + '/lip', token: '--cat-health-3' }
	];
}
