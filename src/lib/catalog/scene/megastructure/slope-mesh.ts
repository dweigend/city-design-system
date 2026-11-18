import * as T from 'three';
import type { routeSlope } from '../../logic/megastructure';
import type { Pigments } from './modules';
import { solid } from './geometry';
/** Generates landing discs and level treads or sloped decks for a routed survey. */
export function slopeMesh(s: NonNullable<ReturnType<typeof routeSlope>>, p: Pigments) {
	const group = new T.Group(),
		width = 1.2;
	for (const [x, y, z] of s.centers) {
		const radius = Math.hypot(s.landing, width / 2);
		const disk = solid(new T.CylinderGeometry(radius, radius, 0.18, 48), p.pink);
		disk.rotation.x = Math.PI / 2;
		disk.position.set(x, y, z - 0.09);
		group.add(disk);
	}
	for (const flight of s.flights) addFlight(group, flight, width, p);
	return group;
}
function addFlight(
	group: T.Group,
	{ a, b, count, run }: NonNullable<ReturnType<typeof routeSlope>>['flights'][number],
	width: number,
	p: Pigments
) {
	const angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
		dz = b[2] - a[2],
		n = Math.max(1, count),
		pitch = count ? 0 : Math.atan2(dz, run);
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n,
			depth = run / (n * Math.cos(pitch));
		const tread = solid(new T.BoxGeometry(depth, width, 0.18), p.pink, p.steel);
		tread.rotation.order = 'ZYX';
		tread.rotation.z = angle;
		tread.rotation.y = -pitch;
		tread.position.set(
			a[0] + t * (b[0] - a[0]),
			a[1] + t * (b[1] - a[1]),
			a[2] + (count ? (i + 1) / n : t) * dz - 0.09
		);
		group.add(tread);
	}
}
