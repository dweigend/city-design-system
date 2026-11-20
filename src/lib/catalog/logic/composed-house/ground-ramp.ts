import type { Vec3 } from '../parametrik/types';
import { houseStair } from '../../data/house-stair';
import type { Station } from './stair-track';
import { place } from './asset-fit';
import { houseObject, type HousePart } from './house-object';
import { parcelSupports } from './stair-parcel';
import { terrainHeight } from './ground';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';

const variants = ['standard', 'medium', 'long'] as const;
const bay = 2.5;

function approach(s: Section, start: Station, next: Station, run: number) {
	const [x, y] = start.xy;
	const length = Math.hypot(next.xy[0] - x, next.xy[1] - y);
	const c = (next.xy[0] - x) / length,
		t = (next.xy[1] - y) / length,
		half = houseStair.width / 2;
	const end: Vec3 = [x + run * c, y + run * t, 0];
	end[2] = terrainHeight(s, end);
	const outline: [number, number][] = [
		[x - t * half, y + c * half],
		[end[0] - t * half, end[1] + c * half],
		[end[0] + t * half, end[1] - c * half],
		[x + t * half, y - c * half]
	];
	return { end, top: end[2] + run * 0.08, outline };
}

/** Surveys whole ramp bays and the stair count that meets their high end at a legal riser height. */
export function groundRamp(
	s: Section,
	track: Station[],
	at: (i: number) => number,
	index: number,
	hand: number,
	z: number,
	travelled: number,
	levelSteps: number
) {
	for (let count = variants.length; count >= 1; count--) {
		const run = count * bay;
		const estimate = levelSteps - Math.round((run * 0.08) / houseStair.rise);
		for (const steps of [estimate, estimate - 1, estimate + 1]) {
			if (steps < 1) continue;
			const goings = steps + Math.floor((steps - 1) / 17);
			const last = at(index + hand * goings);
			const ramp = approach(s, track[last], track[at(last + hand)], run);
			if (Math.abs((z - ramp.top) / steps - houseStair.rise) >= 0.02) continue;
			if ((travelled + goings) * houseStair.going + run > 2.2 * (s.top - ramp.end[2])) continue;
			if (parcelSupports(s, ramp.outline)) return { ...ramp, steps };
		}
	}
}

/** Rotates and translates the native eight-percent ramp selected by its surveyed bay count. */
export function mountRamp(
	s: Section,
	surfaces: HouseSurfaces,
	from: Vec3,
	to: Vec3,
	id: string
): HousePart[] {
	const dx = to[0] - from[0],
		dy = to[1] - from[1];
	const count = Math.round(Math.hypot(dx, dy) / bay);
	const object = houseObject('ramp', variants[count - 1], s.seed, {
		instanceId: id,
		slots: { deck: surfaces.deck }
	});
	const center: Vec3 = [(to[0] + from[0]) / 2, (to[1] + from[1]) / 2, to[2]];
	return place(object.parts, [0, 0, 0], center, [1, 1, 1], Math.atan2(dy, dx)).map((p) => ({
		...p,
		structuralRole: 'bearing'
	}));
}
