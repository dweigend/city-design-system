import { townMovement } from './town-movement';
import { townLife } from './town-life';
import { ribbonDeck } from './ribbon-deck';
import { ribbonEntry } from './ribbon-entry';
import { ribbonNetwork } from './ribbon-network';
import { courtLawn } from './court-lawn';
import { courtSurfaces } from './town-palette';
import { walkingProfile } from './walking-profile';
import { throughRoute, type CourtPassage } from './through-route';
import { courtTerrace } from './court-terrace';
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
	const passages = courts.flatMap((c, i) => {
		if (!stations.has(c.id)) return [];
		for (const p of c.passages ?? []) {
			if (!p.clearApproach) continue;
			const clear = p.clearApproach;
			const route = throughRoute(gardens[i].landing, p, ground, (a, b) =>
				clear(a, b, walkingProfile.width)
			);
			if (route.length) return [{ court: c.id, spans: route }];
		}
		return [];
	});

	const { graph, approaches, links } = townMovement(
		routes,
		stations,
		new Map(courts.map((c, i) => [c.id, gardens[i]])),
		passages
	);
	return {
		ends,
		stations,
		spans,
		gardens,
		unresolved,
		terraces,
		courts,
		graph,
		approaches,
		links,
		passages
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
	const { stations, gardens, terraces, courts, approaches, links, passages } = surveyTownWalk(
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
	const parity = Math.floor(2 * hashUnit(seed, 'terrace-finish'));
	for (const [i, court] of courts.entries()) plazas.push(...plazaParts(court, i + parity));
	const courtMouths = new Map(courts.map((court, i) => ['court/' + court.id, gardens[i]]));
	const planting = gardens.flatMap((g) => g.parts);
	const network = ribbonNetwork(links, stations);
	const entries = passages.flatMap(({ spans }) => ribbonEntry(spans, ground, plazas));
	const deck = ribbonDeck(network, ground, plazas, { clear, water, mouths: approaches });
	const walkers = townLife(
		network.reaches.map((r) => ({ id: r.id, path: r.sections.map((s) => s.centre) })),
		gardens.map((g) => g.landing),
		seed
	);
	return [
		...flushDecks(plazas).flatMap((plate) => courtLawn(plate, courtMouths.get(plate.id))),
		...deck,
		...entries,
		...walkers,
		...planting,
		...visitors
	];
}
