import { roomOnDeck } from '../house-typology';
import type { Section } from './types';
import type { StockPart } from './house-object';
import type { SectionSurfaces } from './surfaces';
import { members } from './provider';
import { place } from './asset-fit';
import type { Vec3 } from '../parametrik/types';

type Floor = Extract<StockPart, { kind: 'prism' }>;
type Level = Section['composition']['levels'][number];
function fits(floor: Floor, x: number, y: number, r: number) {
	return roomOnDeck(floor.polygon, floor.holes ?? [], x, y, r, r);
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
export function terraceFurniture(s: Section, house: StockPart[], surfaces: SectionSurfaces) {
	const planted = s.composition.levels.flatMap((l, i) => {
		const base = s.id + '/level/' + i + '/';
		const floor = house.find(
			(p): p is Floor => p.kind === 'prism' && (p.id === base + 'deck' || p.id === base + 'landing')
		);
		if (!floor) return [];
		const people = s.composition.people.filter((p) => p.level === i).map((p) => p.position);
		const spot = seat(floor, l, people);
		if (!spot) return [];
		return planter(s, surfaces, base, l.use, spot, floor);
	});
	const roof = house.find((p): p is Floor => p.kind === 'prism' && p.id.endsWith('/roof-walk'));
	if (s.composition.sharedRoof === 'terrace' || !roof || !roof.polygon.length) return planted;
	const xs = roof.polygon.map((p) => p[0]),
		ys = roof.polygon.map((p) => p[1]);
	const left = Math.min(...xs),
		right = Math.max(...xs),
		front = Math.min(...ys),
		rear = Math.max(...ys);
	if (Math.min(right - left, rear - front) < 1.25) return planted;
	const z = roof.z + roof.height;
	const residents = s.composition.people.filter((p) => Math.abs(p.position[2] - z) < 0.01);
	const crown = s.composition.crown;
	const candidates = [0.18, 0.82, 0.32, 0.68].flatMap((u) =>
		[0.18, 0.82, 0.32, 0.68].map((v) => [left + u * (right - left), front + v * (rear - front)])
	);
	const r = Math.min(0.34, (right - left) / 8, (rear - front) / 8);
	const spot = candidates.find(
		([x, y]) =>
			Math.abs(x - s.composition.bay.x) + r <= s.composition.bay.width / 2 &&
			Math.abs(y - s.composition.bay.y) + r <= s.composition.bay.depth / 2 &&
			fits(roof, x, y, r) &&
			(crown.position[2] > z + 1 ||
				Math.abs(x - crown.position[0]) > crown.size[0] / 2 + r ||
				Math.abs(y - crown.position[1]) > crown.size[1] / 2 + r) &&
			residents.every((p) => Math.hypot(x - p.position[0], y - p.position[1]) > r + 0.42)
	);
	if (!spot) return planted;
	const [x, y] = spot;
	return planted.concat(
		planter(s, surfaces, s.id + '/roof/', s.composition.crown.use, { x, y, r }, roof)
	);
}
function planter(
	s: Section,
	surfaces: SectionSurfaces,
	base: string,
	use: Level['use'],
	spot: { x: number; y: number; r: number },
	floor: Floor
) {
	const stock = members('rolled-lip-planter', 'compact', s.seed, base + 'furniture', surfaces, use);
	const scale = spot.r / 0.69;
	return place(
		stock,
		[0, 0, 0],
		[spot.x, spot.y, floor.z + floor.height],
		[scale, scale, scale],
		0
	).map((p) => ({ ...p, structuralRole: 'occupant' as const, carrier: floor.id }));
}
