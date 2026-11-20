import {
	movementNetwork,
	type DockRequest,
	type MovementElement,
	type MovementPort,
	type MovementKind
} from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import { required } from '../required';
import type { ribbonNetwork } from './ribbon-network';
import { fitApproaches } from './ribbon-fit';
import { ribbonProfile } from './ribbon-column';
import { walkingLink, walkingConnectionProfile as profile } from './walking-connection';
import { seatMouth } from './ribbon-mouth';
import { passageReaches } from './passage-reaches';
import type { TownSpan } from './town-stations';
type Layout = ReturnType<typeof ribbonNetwork>;
type Reach = Layout['reaches'][number];
type Mouth = { landing: Vec3; heading: number };
type Ground = (x: number, y: number) => number;
type Survey = {
	ports: Map<string, MovementPort>;
	elements: MovementElement[];
	requests: DockRequest[];
};
function port(
	id: string,
	kind: MovementKind,
	position: Vec3,
	heading: number,
	width: number
): MovementPort {
	return {
		id,
		kind,
		position,
		heading,
		width,
		headroom: profile.headroom,
		accepts: [
			'walkway',
			'path',
			'court',
			'station',
			'bridge',
			'ramp',
			'stair',
			'entrance',
			'tunnel'
		]
	};
}
function element(
	id: string,
	kind: MovementKind,
	from: string,
	to: string,
	width: number
): MovementElement {
	return {
		id,
		kind,
		from,
		to,
		width,
		capacity: (profile.capacity * width) / profile.width,
		mode: 'walk'
	};
}
function registerEnd(
	s: Survey,
	r: Reach,
	side: number,
	width: number,
	mouths: ReadonlyMap<string, Mouth>
) {
	const end = r.terminals[side],
		hub = r.hubs[side],
		mouth = mouths.get(end);
	const sections = r.sections,
		i = side ? sections.length - 1 : 0;
	const position = sections[i].centre,
		next = sections[i + (side ? -1 : 1)].centre;
	const heading = mouth
		? mouth.heading + Math.PI
		: Math.atan2(position[1] - next[1], position[0] - next[0]);
	const id = mouth ? end + '/approach' : end;
	if (!s.ports.has(id)) s.ports.set(id, port(id, 'walkway', position, heading, width));
	if (hub) s.elements.push(element(id + '/landing', 'junction', hub, id, width));

	if (mouth) {
		registerCourt(s, end, id, mouth, width);
		seatMouth(side ? sections.toReversed() : sections, mouth.heading);
	}
	return id;
}
function registerCourt(s: Survey, end: string, id: string, mouth: Mouth, width: number) {
	if (!s.ports.has(end)) {
		s.ports.set(end, port(end, 'court', mouth.landing, mouth.heading, width));
		s.requests.push({
			id: end + '/dock',
			from: end,
			to: id,
			profile: { ...profile, width, capacity: (profile.capacity * width) / profile.width }
		});
	}
}
function registerReach(
	s: Survey,
	r: Reach,
	from: string,
	to: string,
	kind: MovementKind,
	width: number,
	guardGroup?: string
) {
	const samples = r.sections;
	s.elements.push({
		...element(r.id, kind, from, to, width),
		guardGroup,
		via: samples.slice(1, -1).map((p) => p.centre),
		normals: samples.map(({ left, centre }) => [
			((left[0] - centre[0]) * 2) / width,
			((left[1] - centre[1]) * 2) / width
		])
	});
}
function registerPassage(s: Survey, court: string, spans: TownSpan[], ground: Ground) {
	let from = court;
	for (const { reach, adapter, inside, last } of passageReaches(spans, ground)) {
		const to = reach.id + '/end',
			p = required(reach.sections.at(-1), 'passage endpoint').centre;
		const q = required(reach.sections.at(-2), 'passage heading').centre;
		if (adapter) {
			const start = required(s.ports.get(from), 'passage landing').position;
			const flight = walkingLink(reach.id, [...start], p, 'entrance', 'path');
			for (const port of flight.ports) s.ports.set(port.id, port);
			s.elements.push(
				element(reach.id + '/landing', 'junction', from, flight.ports[0].id, profile.width),
				...flight.edges
			);
			from = flight.ports[1].id;
			continue;
		}
		s.ports.set(
			to,
			port(to, last ? 'path' : 'entrance', p, Math.atan2(p[1] - q[1], p[0] - q[0]), profile.width)
		);
		registerReach(
			s,
			reach,
			from,
			to,
			inside ? 'tunnel' : 'path',
			profile.width,
			reach.id + '/rail'
		);
		from = to;
	}
}
/** Solves alignment and elevation once. The emitted edges carry the complete walking
 * centreline, cross-section bearings and their two named ports. */
export function townMovement(
	layout: Layout,
	mouths: ReadonlyMap<string, Mouth>,
	passages: { court: string; spans: TownSpan[] }[],
	ground: Ground,
	clear?: (a: Vec3, b: Vec3) => boolean,
	water?: Ground
) {
	const survey: Survey = { ports: new Map(), elements: [], requests: [] };
	fitApproaches(layout, ground, clear, water);
	const width = ribbonProfile.width;
	for (const f of layout.forks)
		survey.ports.set(f.id, {
			...port(f.id, 'junction', f.position, 0, width),
			rim: f.rim.map((arc) => arc.map(([x, y]) => [x, y]))
		});
	for (const r of layout.reaches) {
		const from = registerEnd(survey, r, 0, width, mouths),
			to = registerEnd(survey, r, 1, width, mouths);
		const crosses = water && r.sections.some(({ centre: [x, y] }) => Number.isFinite(water(x, y)));
		registerReach(survey, r, from, to, crosses ? 'bridge' : 'walkway', width);
	}
	for (const p of passages) registerPassage(survey, p.court, p.spans, ground);
	return movementNetwork([...survey.ports.values()], survey.elements, survey.requests);
}
