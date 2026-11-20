import { townMovement } from './town-movement';
import { townLife } from './town-life';
import { ribbonDeck } from './ribbon-deck';
import { edgePath } from '../movement-network';
import { ribbonNetwork } from './ribbon-network';
import { courtLawn } from './court-lawn';
import { courtSurfaces } from './town-palette';
import { walkingProfile } from './walking-profile';
import { throughRoute, type CourtPassage } from './through-route';
import { fitWalkingFlights, type FlightReservation } from './flight-fit';
import { type Primitive, type Vec3 } from '../parametrik/types';
export { publicFlight } from './path-deck';
import { houseSurfaces } from '../composed-house';
import { flushDecks } from './town-floor';
import { courtLife } from './court-life';
import { courtGarden } from './court-garden';
import { finishMaterial } from '../material/surface';
import { hashUnit } from '../../core/random';

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
function plazaParts(court: Court, index: number): Primitive[] {
	const paving = {
		token: courtSurfaces.rim.token,
		finish: courtSurfaces.rim.finishes[index % 2]
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
	return parts;
}
function courtPassage(c: Court, landing: Vec3, ground: (x: number, y: number) => number) {
	for (const p of c.passages ?? []) {
		if (!p.clearApproach) continue;
		const clear = p.clearApproach;
		const route = throughRoute(landing, p, ground, (a, b) => clear(a, b, walkingProfile.width));
		if (route.length && (p.clearInterior?.() ?? true))
			return [{ court: c.id, spans: route, passage: p }];
	}
	return [];
}
/** Surveys the town centrelines and their court terminals in world metres. */
export function surveyTownWalk(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	survey: Court[],
	ground: (x: number, y: number) => number,
	seed: number,
	relief = ground,
	reservations: ReadonlyMap<string, FlightReservation> = new Map(),
	clear?: (a: Vec3, b: Vec3) => boolean,
	water?: (x: number, y: number) => number
) {
	const courts = survey;
	const mouths = new Map(routes.map((path) => [path[0], center(path[1])]));
	const gardens = courts.map((c) =>
		courtGarden(c, mouths.get(c.id) ?? c.position, seed, ground, relief)
	);
	const ends = new Map(courts.map((c, i) => [c.id, gardens[i].landing]));
	const stations = townStations(routes, center, ends);
	const links = townLinkSurvey(routes, stations, ends);
	// Older survey consumers inspect the straight-link tread budget independently of the fitted ribbon.
	const flightBudget = () =>
		fitWalkingFlights(townSpans(links, stations, ends, ground), reservations);
	const passages = courts.flatMap((court, i) =>
		stations.has(court.id) ? courtPassage(court, gardens[i].landing, ground) : []
	);

	const graph = townMovement(
		ribbonNetwork(routes, stations),
		new Map(courts.map((c, i) => [c.id, gardens[i]])),
		passages,
		ground,
		clear,
		water
	);
	return {
		passages: new Map(passages.map((p) => [p.passage.id, p.passage])),
		ends,
		stations,
		get spans() {
			return flightBudget().spans;
		},
		gardens,
		get unresolved() {
			return flightBudget().unresolved;
		},
		courts,
		graph
	};
}
/** Sweeps the shared public ribbon between finished court edges, forks and surveyed building openings. */
export function townDeck(
	routes: readonly string[][],
	center: (id: string) => Vec3,
	survey: Court[],
	ground: (x: number, y: number) => number,
	seed: number,
	relief = ground,
	reservationsByLink: ReadonlyMap<string, FlightReservation> = new Map(),
	clear?: (a: Vec3, b: Vec3) => boolean,
	water?: (x: number, y: number) => number
) {
	const plan = surveyTownWalk(
		routes,
		center,
		survey,
		ground,
		seed,
		relief,
		reservationsByLink,
		clear,
		water
	);
	return projectTownWalk(plan, ground, seed);
}
/** Dresses the edges and courts of a completed survey without changing their alignment. */
export function projectTownWalk(
	{ gardens, courts, graph }: ReturnType<typeof surveyTownWalk>,
	ground: (x: number, y: number) => number,
	seed: number
) {
	const plazas: Primitive[] = [];
	const visitors = courts.flatMap((c, i) => courtLife(c, seed, true, gardens[i].landing));
	const parity = Math.floor(2 * hashUnit(seed, 'terrace-finish'));
	for (const [i, court] of courts.entries()) plazas.push(...plazaParts(court, i + parity));
	const courtMouths = new Map(courts.map((court, i) => ['court/' + court.id, gardens[i]]));
	const planting = gardens.flatMap((g) => g.parts);
	const deck = ribbonDeck(graph, ground, plazas);
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const walkers = townLife(
		graph.edges
			.filter((e) => e.kind === 'walkway' || e.kind === 'bridge')
			.map((e) => ({ id: e.id, path: edgePath(e, ports).map((p): Vec3 => [...p]) })),
		gardens.map((g) => g.landing),
		seed
	);
	return [
		...flushDecks(plazas).flatMap((plate) => courtLawn(plate, courtMouths.get(plate.id))),
		...deck,
		...walkers,
		...planting,
		...visitors
	];
}
