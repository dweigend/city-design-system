import { buildObject, dressSurface, type MaterialAssignment, type SlotAssignment } from '../assets';
import { projectGroundLanding } from './ground-landing';
import { edgePath, type MovementGraph } from '../movement-network';
import { edgeSections } from './edge-sections';
import { stairEdge } from './path-deck';
import { column, ribbonProfile } from './ribbon-column';
import { pathSupports, pathTube, contours } from '../linear-path';
import type { Primitive, Vec3 } from '../parametrik/types';
import { guardRuns, landingGround } from './guard-runs';
import { pathSurfaces } from './town-palette';

type Ground = (x: number, y: number) => number;
type RibbonSlotSurface = SlotAssignment | MaterialAssignment;
/**
 * Optional surface overrides for swept ribbon segments (`walking`, `bearing`) and their
 * exposed guards (`guard`). Stairs, landings and junctions keep `pathSurfaces`.
 */
export type RibbonSlots = Partial<Record<'walking' | 'bearing' | 'guard', RibbonSlotSurface>>;

const productionSegmentSlots: Readonly<Record<'walking' | 'bearing', SlotAssignment>> = {
	walking: { token: pathSurfaces.walking.token, finish: pathSurfaces.walking.finish },
	bearing: { token: pathSurfaces.bearing.token, finish: pathSurfaces.bearing.finish }
};

function guardSurface(assignment: RibbonSlotSurface | undefined) {
	return {
		role: pathSurfaces.guard.role,
		...dressSurface(pathSurfaces.guard, assignment)
	};
}

function guard(path: Vec3[], id: string, surface: RibbonSlotSurface | undefined): Primitive[] {
	const railHeight = 1.04;
	const dress = guardSurface(surface);
	return [
		{
			...dress,
			edges: false,
			id,
			...pathTube(
				path.map(([x, y, z]): Vec3 => [x, y, z + railHeight]),
				ribbonProfile.railRadius
			)
		},
		...pathSupports(path, 3.6).map((p, j): Primitive => ({
			...dress,
			edges: false,
			id: id + '/post/' + j,
			kind: 'cylinder',
			position: p,
			height: railHeight,
			radius: ribbonProfile.postRadius
		}))
	];
}

function segmentSlots(
	slots: RibbonSlots | undefined
): Readonly<Record<'walking' | 'bearing', RibbonSlotSurface>> {
	return {
		walking: slots?.walking ?? productionSegmentSlots.walking,
		bearing: slots?.bearing ?? productionSegmentSlots.bearing
	};
}

/** Projects finished walking edges and their junction boundaries in world metres. */
export function ribbonDeck(
	graph: MovementGraph,
	ground: Ground,
	courts: Primitive[],
	slots?: RibbonSlots
) {
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const landings = new Set(
		graph.edges
			.filter((e) => e.kind === 'dock' && ports.get(e.to)?.groundLanding)
			.map((e) => e.from)
	);
	const support = landingGround(courts, ground);
	const rails = new Map<string, Vec3[][]>();
	function exposed(edge: Vec3[], side: 1 | -1, group = 'town-walk/rail') {
		const row = rails.get(group) ?? [];
		row.push(...guardRuns(edge, support, (p) => p[2], side, ribbonProfile.guardDrop));
		rails.set(group, row);
	}
	const ribbonSurface = segmentSlots(slots);
	const parts = graph.edges.flatMap((e) => {
		if (e.mode !== 'walk' || e.kind === 'dock' || e.kind === 'junction' || e.kind === 'court')
			return [];
		const path = edgePath(e, ports);
		if (e.kind === 'stair') return stairEdge(e.id, path, e.width, ground);
		const sections = edgeSections(e, path);
		if (e.kind !== 'tunnel') {
			exposed(
				sections.map((s) => s.left),
				-1,
				e.guardGroup
			);
			exposed(
				sections.map((s) => s.right),
				1,
				e.guardGroup
			);
		}
		const variant = e.kind === 'tunnel' ? 'tunnel' : landings.has(e.to) ? 'paired' : 'supported';
		const edgePorts = { start: ports.get(e.from), end: ports.get(e.to) };
		return buildObject('ribbon-segment', variant, 0, {
			instanceId: e.id,
			slots: ribbonSurface,
			site: { sections, ground, ports: edgePorts }
		}).parts;
	});
	for (const p of graph.ports) {
		parts.push(...projectGroundLanding(p, ground));
		if (!p.rim) continue;
		const position: Vec3 = [...p.position];
		const rim = p.rim.map((arc) => arc.map(([x, y]): Vec3 => [x, y, position[2]]));
		const id = 'town-walk/joint/' + p.id;
		parts.push(
			{
				...pathSurfaces.walking,
				id,
				kind: 'prism',
				polygon: rim.flat().map(([x, y]) => [x, y]),
				z: position[2] - ribbonProfile.depth,
				height: ribbonProfile.depth
			},
			...column(id + '/pier/0', position, ground)
		);
		for (const arc of rim) exposed(arc, 1);
	}
	return [
		...parts,
		...[...rails].flatMap(([id, segments]) =>
			contours(segments).flatMap((p, i) => guard(p, id + '/' + i, slots?.guard))
		)
	];
}
