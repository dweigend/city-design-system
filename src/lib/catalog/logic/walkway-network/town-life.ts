import { privateSurface } from './town-palette';
import { buildObject } from '../assets';
import { translate } from '../ansicht/geometrie';
import { hashUnit } from '../../core/random';
import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
import type { TownSpan } from './town-stations';

function placed(asset: string, point: Vec3, id: string, seed: number) {
	const variant =
		asset === 'rolled-lip-planter' || asset === 'backrest-bench' ? 'compact' : 'relaxed';
	return buildObject(asset, variant, seed, { instanceId: id + '/' + asset }).parts.map((p) =>
		translate(privateSurface(p), point)
	);
}

/** Distributes rigid registry figures by usable deck area. Groups of six
 * contain a walking pair, a seated pair and two standing figures. */
export function townLife(
	spans: TownSpan[],
	courts: { id: string; position: Vec3; area: number }[],
	seed: number
) {
	const parts: Primitive[] = [];
	const parties = [
		{ asset: 'person-walking-pair', size: 2 },
		{ asset: 'person-seated-pair', size: 2 },
		{ asset: 'person-standing', size: 1 },
		{ asset: 'person-standing', size: 1 }
	];
	let party = 0;
	let walked = 0,
		people = 0,
		furniture = 0;
	for (const { id, a, b } of spans) {
		if (a[2] !== b[2]) continue;
		const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
		const end = walked + length;
		while ((people + 1) * 7 <= end) {
			const { asset, size } = parties[party++ % parties.length];
			const t = Math.max(0.12, Math.min(0.88, ((people + 1) * 7 - walked) / length));
			parts.push(...placed(asset, interpolatePoint(a, b, t), id + '/life/' + people, seed));
			people += size;
		}
		if (Math.floor(end / 30) > furniture) {
			parts.push(...placed('rolled-lip-planter', interpolatePoint(a, b, 0.7), id + '/bench', seed));
			furniture++;
		}
		walked = end;
	}
	return [...parts, ...courtLife(courts, people, seed)];
}
function courtLife(
	courts: { id: string; position: Vec3; area: number }[],
	visitors: number,
	seed: number
) {
	const parts: Primitive[] = [];
	for (const court of courts) {
		const count = Math.max(1, Math.round(court.area / 17.5)),
			[x, y, z] = court.position;
		parts.push(...placed('backrest-bench', [x + 0.8, y, z], court.id + '/bench', seed));
		for (let i = 0; i < count; i++) {
			const angle = 2 * Math.PI * (i / count + hashUnit(seed, court.id));
			parts.push(
				...placed(
					visitors++ % 3 === 0 ? 'person-walking-left' : 'person-standing',
					[x + Math.cos(angle), y + Math.sin(angle), z],
					court.id + '/court/' + i,
					seed
				)
			);
		}
	}
	return parts;
}
