import { chords, type Point2 } from '../ansicht/geometrie';
import { pedestrianHeadroom, type MovementPort } from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';
import { sectionParts } from './projection';
import { jamb } from './passage-frame';
import { canOpenPassage } from './passage-cut';

type HousePassage = ReturnType<typeof passage>;
const halfWidth = 1.28;

function passage(id: string, a: Point2, b: Point2, z: number, normal: Point2) {
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const along: Point2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
	const threshold = (xy: Point2, sign: number) => {
		const outward: Point2 = [sign * along[0], sign * along[1]];
		const position: Vec3 = [...xy, z];
		const port: MovementPort = {
			id: id + '/portal/' + (sign < 0 ? 'a' : 'b'),
			kind: 'entrance',
			position,
			heading: Math.atan2(outward[1], outward[0]),
			width: 2 * halfWidth,
			headroom: pedestrianHeadroom,
			accepts: ['path', 'walkway', 'tunnel']
		};
		return { position, outward, port };
	};
	const entry = threshold(a, -1),
		exit = threshold(b, 1);
	return {
		id,
		entry,
		exit,
		centreline: [entry.position, exit.position],
		clearWidth: 2 * halfWidth,
		stepFree: true,
		headroom: pedestrianHeadroom,
		normal,
		offset: a[0] * normal[0] + a[1] * normal[1]
	};
}

function lanes(section: Section, normal: Point2, floor: number) {
	const ring = section.composition.structure.parcel.polygon;
	const offsets = ring.map(([x, y]) => x * normal[0] + y * normal[1]);
	const low = Math.min(...offsets) + halfWidth + jamb,
		high = Math.max(...offsets) - halfWidth - jamb;
	const rows: HousePassage[] = [];
	for (let d = low; d <= high; d += 0.2) {
		const [ends] = chords(ring, { normal, d });
		if (ends) rows.push(passage(section.id, ...ends, floor, normal));
	}
	return rows;
}

/** Surveys full-width lanes between opposite parcel faces, leaving the house stair and its landings intact. */
export function housePassages(
	section: Section,
	courtFloor: number,
	ground: (x: number, y: number) => number
) {
	const { structure } = section.composition;
	if (
		section.start ||
		structure.principle !== 'layers' ||
		!section.composition.exterior ||
		structure.parcel.polygon.length !== 4 ||
		structure.parcel.holes.length
	)
		return [];
	const ring = structure.parcel.polygon;
	let parts: ReturnType<typeof sectionParts> | undefined;
	const floor = Math.max(courtFloor, ...ring.map(([x, y]) => ground(x, y) + 0.05));
	return ring.flatMap(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length],
			length = Math.hypot(u - x, v - y);
		return lanes(section, [(y - v) / length, (u - x) / length], floor).map((p) => ({
			...p,
			clearInterior: () => canOpenPassage((parts ??= sectionParts(section)), p)
		}));
	});
}
