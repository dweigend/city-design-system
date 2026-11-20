import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
import { deckCorners, spanSurvey } from '../walkway';
import { houseSurfaces } from '../composed-house';
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
	return parts;
}

type Court = { id: string; position: Vec3; area: number; polygon: [number, number][] };
/** Projects horizontal 2.5 m spans and matching steps between even-metre
 * landings. Terminals descend into courts. Degree-three junctions have an open plaza. */
export function townDeck(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	courts: Court[],
	ground: (x: number, y: number) => number,
	seed: number
) {
	const ends = new Map(courts.map((c) => [c.id, c.position]));
	const stations = townStations(routes, center, ends);
	const spans = townSpans(routes, stations, ends);
	const plazas: Primitive[] = [];
	const space = courts.map((c) => ({ id: c.id, position: c.position, area: c.area }));
	for (const [id, { position, arms }] of stations)
		if (arms.length > 1) {
			const [x, y, z] = position;
			const fork = arms.length === 3,
				radius = fork ? width : width / 2;
			plazas.push({
				...deck,
				id: 'town-walk/joint/' + id,
				kind: 'cylinder',
				position: [x, y, z - thickness],
				height: thickness,
				radius
			});
			if (fork) space.push({ id: 'town-walk/plaza/' + id, position, area: Math.PI * radius ** 2 });
		}
	for (const court of courts)
		plazas.push({
			...frame,
			...houseSurfaces.deck,
			id: 'court/' + court.id,
			kind: 'prism',
			polygon: court.polygon,
			z: court.position[2] - thickness,
			height: thickness
		});
	return [
		...spans.flatMap((s) => publicFlight(s, ground)),
		...plazas,
		...townLife(spans, space, seed)
	];
}
