import { joinRings } from '../profile-fit';
import type { MeshForm, Vec3 } from '../parametrik/types';
import type { buildVessel } from './vessel';

type Vessel = NonNullable<ReturnType<typeof buildVessel>>;
type Layout = { count: number; stride: number; azimuth: number; contactRing: number };
type Indices = Pick<MeshForm, 'triangles' | 'lines'>;

function strips(rows: number, count: number) {
	const body: Indices = { triangles: [], lines: [] },
		lip: Indices = { triangles: [], lines: [] };
	for (let i = 0; i < 2 * rows; i++) {
		const rim = i === rows - 1;
		const current = rim ? 0 : i,
			next = rim ? 1 : (i + 1) % (2 * rows);
		const out = rim ? lip.triangles : body.triangles;
		joinRings(out, current * count, next * count, count);
	}
	for (const i of [0, 1])
		lip.lines.push(Array.from({ length: count + 1 }, (_, j) => i * count + (j % count)));
	return { body, lip };
}
const topology = new Map<string, ReturnType<typeof strips>>();

function sampledRings(vessel: Vessel, layout: Layout) {
	const stations = vessel.rings.map((_, i) => i).filter((i) => i % layout.stride === 0);
	const indices = [...new Set([...stations, layout.contactRing])].sort((a, b) => a - b);
	return indices.map((i) => {
		const a = vessel.rings[Math.floor(i)],
			b = vessel.rings[Math.ceil(i)],
			t = i - Math.floor(i);
		const blend = (field: keyof typeof a) => a[field] + t * (b[field] - a[field]);
		return { z: blend('z'), outer: blend('outer'), inner: blend('inner'), offset: blend('offset') };
	});
}

/** Loft L's hollow profile. The reference plate retains all 65 sections and 48 radial segments. */
export function vesselMeshes(
	vessel: Vessel,
	origin: Vec3,
	angle: number,
	scale = 1,
	layout?: Layout
) {
	const rings = layout ? sampledRings(vessel, layout) : vessel.rings;
	const count = layout?.count ?? 48,
		key = rings.length + '/' + count;
	const faces = topology.get(key) ?? strips(rings.length, count);
	topology.set(key, faces);
	const directions = Array.from({ length: count }, (_, j) => {
		const a = (layout?.azimuth ?? angle) + (2 * Math.PI * j) / count;
		return [Math.cos(a), Math.sin(a)];
	});
	const points: Vec3[] = [];
	function ringPoints(r: Vessel['rings'][number], radius: number) {
		const x = origin[0] + scale * r.offset * Math.cos(angle),
			y = origin[1] + scale * r.offset * Math.sin(angle);
		for (const [u, v] of directions)
			points.push([x + scale * radius * u, y + scale * radius * v, origin[2] + scale * r.z]);
	}
	for (const r of rings) ringPoints(r, r.outer);
	for (const r of rings.toReversed()) ringPoints(r, r.inner);
	const first = (rings.length - 1) * count;
	return {
		body: { kind: 'mesh', points, ...faces.body },
		lip: { kind: 'mesh', points: points.slice(first, first + 2 * count), ...faces.lip }
	} satisfies Record<'body' | 'lip', MeshForm>;
}
