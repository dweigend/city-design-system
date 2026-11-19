import { buildVessel, vesselMeshes } from '../art-reference';
import type { DockedModule } from '../megastructure';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal } from '../traeger';

const profiles = new Map<number, ReturnType<typeof makeProfile>>();

/** The saved anchor and world seed identify the same casting during planning and projection. */
export const castingSeed = (seed: number, cell: string) =>
	kanal(seed, 'raumfachwerk', cell, 'ceramic-profile/v1');

function makeProfile(seed: number) {
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
		3 / (2 * Math.max(...v.rings.map((r) => r.outer + Math.abs(r.offset)))),
		4 / v.rings[v.rings.length - 1].z
	);
	return { v, scale };
}

function profile(seed: number) {
	let value = profiles.get(seed);
	if (!value) {
		value = makeProfile(seed);
		if (profiles.size >= 128) profiles.clear();
		profiles.set(seed, value);
	}
	return value;
}

/** Tangency to the capsule's cylindrical side at the widest combined cross section. */
export function ceramicContact(seed: number, pitch: number, direction: number) {
	const { v, scale } = profile(seed);
	const offsets = v.rings.map((r) => {
		const z = scale * r.z;
		if (z > 2 * pitch) return 0;
		return (
			Math.sqrt(z * (2 * pitch - z)) +
			scale * (r.outer + direction * r.offset * Math.sin(v.base.angle))
		);
	});
	const max = Math.max(...offsets);
	return { offset: max - 0.008, ring: offsets.indexOf(max) };
}

/** Seats the profile used for the contact survey at the solved wall socket. */
export function ceramicFitting(
	id: string,
	fitting: DockedModule,
	seed: number,
	coarse: boolean,
	contactRing: number
): Primitive[] {
	const { v, scale } = profile(seed);
	const origin: Vec3 = [
		fitting.center[0],
		fitting.center[1],
		fitting.center[2] - fitting.size[2] / 2
	];
	const { body, lip } = vesselMeshes(
		v,
		origin,
		Math.atan2(fitting.tangent[1], fitting.tangent[0]) + v.base.angle,
		scale,
		{
			stride: coarse ? 8 : 4,
			count: coarse ? 12 : 24,
			azimuth: Math.atan2(fitting.tangent[1], fitting.tangent[0]),
			contactRing
		}
	);
	const base = { role: 'neu', material: 'glaze', shade: 0 } as const;
	return [
		{ ...body, ...base, id, token: '--paper' },
		{ ...lip, ...base, id: id + '/lip', token: '--cat-health-3' }
	];
}
