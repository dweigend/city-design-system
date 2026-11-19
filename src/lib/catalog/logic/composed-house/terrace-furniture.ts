import type { Section } from './types';
import type { HousePart } from './house-object';
import type { HouseSurfaces } from './surfaces';
import { members } from './provider';
import { place } from './asset-fit';
import type { Vec3 } from '../parametrik/types';

type XY = [number, number];
type Floor = Extract<HousePart, { kind: 'prism' }>;
type Level = Section['composition']['levels'][number];
function inside([x, y]: XY, ring: XY[]) {
	let result = false;
	for (const [i, [a, b]] of ring.entries()) {
		const [c, d] = ring[(i + 1) % ring.length];
		if (b > y !== d > y && x < a + ((c - a) * (y - b)) / (d - b)) result = !result;
	}
	return result;
}
function fits(floor: Floor, x: number, y: number, r: number) {
	return [
		[-r, -r],
		[r, -r],
		[r, r],
		[-r, r]
	].every(([u, v]) => {
		const pt: XY = [x + u, y + v];
		return inside(pt, floor.polygon) && !floor.holes?.some((h) => inside(pt, h));
	});
}
function inCabin(l: Level, x: number, y: number, r: number) {
	return l.bodies.some((b) => {
		const c = Math.cos(b.rotation),
			s = Math.sin(b.rotation),
			u = x - b.position[0],
			v = y - b.position[1];
		if (b.band?.court) {
			const court = b.band.court;
			if (
				Math.max(Math.abs(x - court.center[0]), Math.abs(y - court.center[1])) + r <
				court.width / 2
			)
				return false;
		}
		if (b.objectId.includes('lantern') || b.objectId === 'glass-bell')
			return Math.hypot(u, v) < b.size[0] / 2 + r;
		return (
			Math.abs(c * u + s * v) < b.size[0] / 2 + r && Math.abs(c * v - s * u) < b.size[1] / 2 + r
		);
	});
}
function seat(floor: Floor, l: Level, people: Vec3[]) {
	const [ax, ay] = l.landing;
	for (const r of [0.39, 0.24, 0.15]) {
		for (const dy of [0, -0.25, 0.25, -0.55, 0.55, -1, 1]) {
			for (const dx of [1.2, -1.2, 0.8, -0.8, 1.8, -1.8, 0.65, -0.65, 0.5, -0.5, 0]) {
				const x = ax + dx,
					y = ay + dy;
				if (people.some((p) => Math.hypot(x - p[0], y - p[1]) < r + 0.18)) continue;
				if (fits(floor, x, y, r) && !inCabin(l, x, y, r)) return { x, y, r };
			}
		}
	}
}
/** Places one freestanding registry planter on the clear portion of each furnished terrace. */
export function terraceFurniture(s: Section, house: HousePart[], surfaces: HouseSurfaces) {
	const planted = s.composition.levels.flatMap((l, i) => {
		const base = s.id + '/level/' + i + '/';
		const floor = house.find(
			(p): p is Floor => p.kind === 'prism' && (p.id === base + 'deck' || p.id === base + 'landing')
		);
		if (!floor) return [];
		const people = s.composition.people.filter((p) => p.level === i).map((p) => p.position);
		const spot = seat(floor, l, people);
		if (!spot) return [];
		return planter(s, surfaces, base, l.use, spot, l.position[2]);
	});
	const roof = house.find((p): p is Floor => p.kind === 'prism' && p.id.endsWith('/roof-walk'));
	if (!roof || !roof.polygon.length) return planted;
	const [a, , c] = roof.polygon;
	if (Math.min(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])) < 2.5) return planted;
	const x = 0.8 * a[0] + 0.2 * c[0],
		y = 0.8 * a[1] + 0.2 * c[1];
	return planted.concat(
		planter(
			s,
			surfaces,
			s.id + '/roof/',
			s.composition.crown.use,
			{ x, y, r: 0.34 },
			roof.z + roof.height
		)
	);
}
function planter(
	s: Section,
	surfaces: HouseSurfaces,
	base: string,
	use: Level['use'],
	spot: { x: number; y: number; r: number },
	z: number
) {
	const stock = members('rolled-lip-planter', 'compact', s.seed, base + 'furniture', surfaces, use);
	const scale = spot.r / 0.69;
	return place(stock, [0, 0, 0], [spot.x, spot.y, z], [scale, scale, scale], 0);
}
