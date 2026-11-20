import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
import { deckCorners, spanSurvey } from '../walkway';
import { houseSurfaces } from '../composed-house';
import { courtLife } from './court-life';
import { courtGarden } from './court-garden';
import { meetingPlatforms, meetingSites, reservations } from './town-landings';
import { finishMaterial } from '../material/surface';
import { hashUnit } from '../../core/random';
import { townLife } from './town-life';

import { townStations, townSpans, type TownSpan } from './town-stations';
const width = 2.5,
	thickness = 0.2;
const frame = { role: 'neu', material: 'metal', ...houseSurfaces.frame } as const;
const deck = {
	role: 'neu',
	material: 'acrylic',
	token: houseSurfaces.access.token,
	finish: 'kunststoff-formteil'
} as const;

function flight(span: TownSpan): Primitive[] {
	const { a, b, id } = span,
		ring = deckCorners(a, b, width);
	const { treads } = spanSurvey(ring, id, width, { thickness, treadRise: 0.17 });
	const parts: Primitive[] = treads.map((t) => ({ ...deck, ...t, kind: 'prism' }));
	for (const [p, q, side] of [
		[ring[0], ring[3], 'right'],
		[ring[1], ring[2], 'left']
	] as const) {
		const raised = (v: Vec3): Vec3 => [v[0], v[1], v[2] + 1.04];
		parts.push({
			...frame,
			id: id + '/' + side,
			kind: 'pipe',
			points: [raised(p), raised(q)],
			radius: 0.06
		});
		const count = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3);
		for (let i = 0; i < count; i++) {
			const foot = interpolatePoint(p, q, (i + 0.5) / count);
			parts.push({
				...frame,
				id: id + '/' + side + '/' + i,
				kind: 'cylinder',
				position: foot,
				height: 1.04,
				radius: 0.06
			});
		}
	}
	return parts;
}

/** Draws a public deck flight between surveyed landings, with two rails and ground-seated piers. */
export function publicFlight(span: TownSpan, ground: (x: number, y: number) => number) {
	const { a, b, id } = span;
	const parts = flight(span);
	const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12);
	for (let i = 0; i < n; i++) {
		const [x, y, z] = interpolatePoint(a, b, (i + 0.5) / n),
			foot = ground(x, y);
		if (z - thickness > foot)
			parts.push({
				...frame,
				kind: 'cylinder',
				id: id + '/pier/' + i,
				position: [x, y, foot],
				height: z - thickness - foot,
				radius: 0.2
			});
	}
	return parts.some((p) => p.id.startsWith(id + '/pier/'))
		? parts
		: parts.map((p) => (p.kind === 'prism' ? { ...p, ...houseSurfaces.deck } : p));
}

type Court = {
	aprons?: [number, number][][];
	id: string;
	position: Vec3;
	area: number;
	polygon: [number, number][];
};
function plazaParts(
	court: Court,
	index: number,
	point: (along: number, out: number) => [number, number],
	ground: (x: number, y: number) => number
): Primitive[] {
	const paving = {
		token: '--cat-nature-2',
		finish: index % 2 === 0 ? 'beton-terrazzo' : 'holz-natur'
	} as const;
	const plate = {
		...frame,
		...paving,
		material: finishMaterial(paving.finish),
		id: 'court/' + court.id,
		kind: 'prism' as const,
		polygon: court.polygon,
		z: court.position[2] - 0.6,
		height: 0.6
	};
	const parts: Primitive[] = [plate];
	for (const [i, polygon] of (court.aprons ?? []).entries())
		parts.push({ ...plate, id: plate.id + '/apron/' + i, polygon });
	if (!court.aprons) return parts;
	const top = court.position[2],
		foot = ground(...point(0, 2.4));
	const steps = Math.max(2, Math.ceil((top - foot) / 0.17));
	for (let i = 0; i < steps; i++) {
		const a = (2.4 * i) / steps,
			b = (2.4 * (i + 1)) / steps;
		const polygon = [point(-2, a), point(2, a), point(2, b), point(-2, b)];
		const z = Math.min(...polygon.map(([x, y]) => ground(x, y)), foot) - 0.05;
		parts.push({
			...plate,
			id: plate.id + '/step/' + i,
			polygon,
			z,
			height: top + ((foot - top) * i) / (steps - 1) - z
		});
	}
	return parts;
}
/** Projects horizontal 2.5 m spans and matching steps between even-metre
 * landings. Terminals descend into courts. Degree-three junctions have an open plaza. */
export function townDeck(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	courts: Court[],
	ground: (x: number, y: number) => number,
	seed: number
) {
	const mouths = new Map(routes.map((path) => [path[0], center(path[1])]));
	const gardens = courts.map((c) => courtGarden(c, mouths.get(c.id) ?? c.position, seed));
	const ends = new Map(courts.map((c, i) => [c.id, gardens[i].landing]));
	const stations = townStations(routes, center, ends);
	const spans = townSpans(routes, stations, ends);
	const plazas: Primitive[] = [];
	const visitors = courts.flatMap((c, i) => courtLife(c, seed, true, gardens[i].landing));
	const sites = meetingSites(spans, [...ends.values()]);
	for (const [id, { position, arms }] of stations) {
		if (arms.length < 2 || sites.some((s) => s.position === position)) continue;
		const [x, y, z] = position;
		plazas.push({
			...deck,
			...houseSurfaces.deck,
			id: 'town-walk/joint/' + id,
			kind: 'cylinder',
			position: [x, y, z - thickness],
			height: thickness,
			radius: arms.length === 3 ? width : width / 2
		});
	}
	const parity = Math.floor(2 * hashUnit(seed, 'terrace-finish'));
	for (const [i, court] of courts.entries())
		plazas.push(...plazaParts(court, i + parity, gardens[i].point, ground));
	const planting = gardens.flatMap((g) => g.parts);
	const taken = reservations([...visitors, ...planting.filter((p) => !p.id.endsWith('/bed'))]);
	const meetings = meetingPlatforms(sites, taken, seed, ground);
	return [
		...spans.flatMap((s) => publicFlight(s, ground)),
		...plazas,
		...planting,
		...meetings,
		...townLife(spans, seed, taken),
		...visitors
	];
}
