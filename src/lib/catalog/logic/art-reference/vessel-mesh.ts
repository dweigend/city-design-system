import type { MeshForm, Vec3 } from '../parametrik/types';
import { kreisSegmente } from '../parametrik/rundung';
import type { buildVessel } from './vessel';

type Vessel = NonNullable<ReturnType<typeof buildVessel>>;

/** Projects L's hollow profile into P1 world-space meshes. The upper annulus alone forms the lip. */
export function vesselMeshes(vessel: Vessel, origin: Vec3, angle: number, scale = 1) {
	const { rings } = vessel;
	const count = kreisSegmente(Math.max(...rings.map((r) => r.outer)) * scale);
	const profile = [
		...rings.map((r) => ({ ...r, radius: r.outer })),
		...rings.toReversed().map((r) => ({ ...r, radius: r.inner }))
	];
	const points: Vec3[] = profile.flatMap((r) =>
		Array.from({ length: count }, (_, j): Vec3 => {
			const a = (j * 2 * Math.PI) / count + angle;
			return [
				origin[0] + scale * (r.offset * Math.cos(angle) + r.radius * Math.cos(a)),
				origin[1] + scale * (r.offset * Math.sin(angle) + r.radius * Math.sin(a)),
				origin[2] + scale * r.z
			];
		})
	);
	const mesh = (): MeshForm => ({ kind: 'mesh', points, triangles: [], lines: [] });
	const body = mesh(),
		lip = mesh();
	for (let i = 0; i < profile.length; i++) {
		const form = i === rings.length - 1 ? lip : body;
		const next = (i + 1) % profile.length;
		for (let j = 0; j < count; j++) {
			const k = (j + 1) % count;
			form.triangles.push(
				i * count + j,
				i * count + k,
				next * count + j,
				i * count + k,
				next * count + k,
				next * count + j
			);
		}
	}
	for (const i of [rings.length - 1, rings.length])
		lip.lines.push(Array.from({ length: count + 1 }, (_, j) => i * count + (j % count)));
	// The lip carries only its two rings so selection and section bounds stay local.
	const first = (rings.length - 1) * count;
	lip.points = points.slice(first, first + 2 * count);
	lip.triangles = lip.triangles.map((index) => index - first);
	lip.lines = lip.lines.map((path) => path.map((index) => index - first));
	return { body, lip };
}
