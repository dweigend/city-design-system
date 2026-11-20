import { walkingProfile } from './walking-profile';
import { throughRoute, type CourtPassage } from './through-route';
import { landingGround } from './guard-runs';
import { courtTerrace } from './court-terrace';
import { fitWalkingFlights, type FlightReservation } from './flight-fit';
import { levelRuns } from './level-runs';
import { type Primitive, type Vec3 } from '../parametrik/types';
import { pathDeck } from './path-deck';
export { publicFlight } from './path-deck';
import { townPath } from './town-path';
import { houseSurfaces } from '../composed-house';
import { flushDecks } from './town-floor';
import { courtLife } from './court-life';
import { courtGarden } from './court-garden';
import { meetingPlatforms, meetingSites, reservations } from './town-landings';
import { finishMaterial } from '../material/surface';
import { hashUnit } from '../../core/random';
import { townLife } from './town-life';

import { townLinkSurvey, townStations, townSpans } from './town-stations';
const frame = { role: 'neu', material: 'metal', ...houseSurfaces.frame } as const;
type Court = {
	passages?: CourtPassage[];

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
		finish: index % 2 === 0 ? 'beton-terrazzo' : 'beton-schalung'
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
	const steps = Math.max(2, 1 + Math.ceil(Math.abs(top - foot) / 0.17));
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
/** Surveys the town centrelines and their court terminals in world metres. */
export function surveyTownWalk(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	survey: Court[],
	ground: (x: number, y: number) => number,
	seed: number,
	relief = ground,
	reservations: ReadonlyMap<string, FlightReservation> = new Map()
) {
	const terraces = survey.map((c) =>
		c.aprons?.length === 0 ? courtTerrace(c, relief, ground) : { court: c, steps: [] }
	);
	const courts = terraces.map(({ court }, i) => ({ ...survey[i], ...court }));
	const mouths = new Map(routes.map((path) => [path[0], center(path[1])]));
	const gardens = courts.map((c) =>
		courtGarden(c, mouths.get(c.id) ?? c.position, seed, ground, relief)
	);
	const ends = new Map(courts.map((c, i) => [c.id, gardens[i].landing]));
	const stations = townStations(routes, center, ends);
	const { spans, unresolved } = fitWalkingFlights(
		townSpans(townLinkSurvey(routes, stations, ends), stations, ends, ground),
		reservations
	);
	return { ends, stations, spans, gardens, unresolved, terraces, courts };
}
/** Projects 2.5 m paths and matching steps between surveyed
 * landings. Terminals descend into courts. Degree-three junctions have an open plaza. */
export function townDeck(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	survey: Court[],
	ground: (x: number, y: number) => number,
	seed: number,
	relief = ground,
	reservationsByLink: ReadonlyMap<string, FlightReservation> = new Map()
) {
	const { ends, stations, spans, gardens, terraces, courts } = surveyTownWalk(
		routes,
		center,
		survey,
		ground,
		seed,
		relief,
		reservationsByLink
	);
	const plazas: Primitive[] = terraces.flatMap((t) => t.steps);
	const visitors = courts.flatMap((c, i) => courtLife(c, seed, true, gardens[i].landing));
	const sites = meetingSites(spans, [...ends.values()]);
	const forks = new Map(
		[...stations].filter(([, s]) => s.arms.length === 3).map(([id, s]) => [id, s.position])
	);
	const passages = courts.flatMap((c, i) => {
		for (const p of c.passages ?? []) {
			if (!p.clearApproach) continue;
			const clear = p.clearApproach;
			const route = throughRoute(gardens[i].landing, p, ground, (a, b) =>
				clear(a, b, walkingProfile.width)
			);
			if (route.length) return route;
		}
		return [];
	});
	const { bands, junctions } = townPath([...spans, ...passages], forks);
	const parity = Math.floor(2 * hashUnit(seed, 'terrace-finish'));
	for (const [i, court] of courts.entries())
		plazas.push(...plazaParts(court, i + parity, gardens[i].point, ground));
	const planting = gardens.flatMap((g) => g.parts);
	const taken = reservations([
		...visitors,
		...planting.filter((p) => !p.id.endsWith('/bed') && !p.id.includes('/garden/soil/'))
	]);
	const meetings = meetingPlatforms(sites, taken, seed, ground);
	return [
		...levelRuns(
			flushDecks([
				...plazas,
				...pathDeck(bands, junctions, ground, {
					guardGround: landingGround([...plazas, ...meetings], ground)
				}),
				...meetings
			]),
			bands
		),
		...planting,
		...townLife(spans, seed, taken),
		...visitors
	];
}
