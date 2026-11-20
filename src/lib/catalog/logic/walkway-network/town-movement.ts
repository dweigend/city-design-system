import {
	movementNetwork,
	type DockRequest,
	type MovementPort,
	type MovementElement,
	type MovementKind
} from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import type { TownSpan } from './town-stations';
import { ribbonProfile } from './ribbon-column';
import { walkingConnectionProfile } from './walking-connection';
import { required } from '../required';

type Station = { position: Vec3; arms: string[] };
type Mouth = { landing: Vec3; heading: number };
const profile = {
	...walkingConnectionProfile,
	width: ribbonProfile.width,
	capacity:
		(walkingConnectionProfile.capacity * ribbonProfile.width) / walkingConnectionProfile.width
};
type Survey = { ports: MovementPort[]; elements: MovementElement[]; requests: DockRequest[] };
const port = (
	id: string,
	kind: MovementKind,
	position: Vec3,
	heading: number,
	accepts: MovementKind[]
): MovementPort => ({
	id,
	kind,
	position,
	heading,
	accepts,
	width: profile.width,
	headroom: profile.headroom
});
const element = (id: string, from: string, to: string, kind: MovementKind): MovementElement => ({
	id,
	from,
	to,
	kind,
	capacity: profile.capacity,
	mode: 'walk'
});
const bearing = (a: Vec3, b: Vec3) => Math.atan2(b[1] - a[1], b[0] - a[0]);

function courtMouth(survey: Survey, id: string, { landing, heading }: Mouth) {
	const approach = id + '/approach';
	survey.ports.push(
		port(id, 'court', landing, heading, ['walkway']),
		port(approach, 'walkway', landing, heading + Math.PI, ['court'])
	);
	survey.requests.push({ id: id + '/dock', from: id, to: approach, profile });
	return approach;
}

function passage(survey: Survey, court: string, spans: TownSpan[]) {
	let from = court;
	for (const [i, s] of spans.entries()) {
		const sill = !!s.inside !== !!spans[i + 1]?.inside;
		const to = s.id + '/end';
		survey.ports.push(
			port(to, sill ? 'entrance' : 'path', s.b, bearing(s.a, s.b), ['path', 'walkway'])
		);
		survey.elements.push(element(s.id, from, to, s.inside ? 'walkway' : 'path'));
		from = to;
	}
}

/** Assembles surveyed town routes, oriented court approaches and certified house passages.
 * Both owners share the same oriented mouth on the finished edge. */
export function townMovement(
	routes: readonly string[][],
	stations: Map<string, Station>,
	mouths: Map<string, Mouth>,
	passages: { court: string; spans: TownSpan[] }[]
) {
	const survey: Survey = { ports: [], elements: [], requests: [] };
	const nodes = new Map<string, string>();
	for (const [id, s] of stations) {
		const mouth = mouths.get(id);
		if (mouth) nodes.set(id, courtMouth(survey, id, mouth));
		else {
			const next = required(stations.get(s.arms[0]), 'adjacent station').position;
			survey.ports.push(
				port(id, 'walkway', s.position, bearing(s.position, next), [
					'walkway',
					'station',
					'bridge',
					'tunnel'
				])
			);
			nodes.set(id, id);
		}
	}
	for (const path of routes)
		for (const [i, to] of path.slice(1).entries()) {
			const from = path[i];
			survey.elements.push(
				element(
					'town-walk/' + from + '>' + to,
					required(nodes.get(from), 'route start'),
					required(nodes.get(to), 'route end'),
					'walkway'
				)
			);
		}
	for (const p of passages) passage(survey, p.court, p.spans);
	const graph = movementNetwork(survey.ports, survey.elements, survey.requests);
	return { graph, ...ribbonLinks(graph, nodes, mouths) };
}

function ribbonLinks(
	graph: ReturnType<typeof movementNetwork>,
	nodes: Map<string, string>,
	mouths: Map<string, Mouth>
) {
	const ids = new Map([...nodes].map(([id, port]) => [port, id]));

	const approaches = new Map<string, number>();
	const links = graph.edges.flatMap((e) => {
		const a = ids.get(e.from),
			b = ids.get(e.to),
			mouth = mouths.get(e.from);
		if (mouth && b === e.from) approaches.set(mouth.landing.join(','), mouth.heading);
		return a && b ? [[a, b]] : [];
	});
	return { links, approaches };
}
