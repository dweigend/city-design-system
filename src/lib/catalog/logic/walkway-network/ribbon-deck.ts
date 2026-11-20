import { deckCorners } from '../walkway';
import {
	edgePath,
	type MovementPort,
	type MovementEdge,
	type MovementGraph
} from '../movement-network';
import { edgeSections } from './edge-sections';
import { stairEdge } from './path-deck';
import { column, ribbonProfile } from './ribbon-column';
import { pathSupports, pathTube, profileSolid, contours } from '../linear-path';
import type { Primitive, Vec3 } from '../parametrik/types';
import { guardRuns, landingGround } from './guard-runs';
import type { Section } from './ribbon-curve';
import { pathSurfaces } from './town-palette';
type Ground = (x: number, y: number) => number;
function deck(id: string, sections: Section[], ground: Ground, supported: boolean): Primitive[] {
	// Recess the soffit under the walking edge so the rim casts a narrow shadow.
	const soffit = (p: Vec3, centre: Vec3): Vec3 => [
		p[0] + 0.09 * (centre[0] - p[0]),
		p[1] + 0.09 * (centre[1] - p[1]),
		p[2] - ribbonProfile.depth
	];
	const rings = sections.map(({ left, right, centre }) => [
		soffit(right, centre),
		soffit(left, centre),
		left,
		right
	]);
	const mesh: Primitive = { ...pathSurfaces.walking, id: id + '/ramp', ...profileSolid(rings) };
	if (!supported) return [mesh];
	const path = sections.map((s) => s.centre);
	return [
		mesh,
		...pathSupports(path, ribbonProfile.bay).flatMap((p, i) => column(id + '/pier/' + i, p, ground))
	];
}
function guard(path: Vec3[], id: string): Primitive[] {
	const railHeight = 1.04;
	return [
		{
			...pathSurfaces.guard,
			edges: false,
			id,
			...pathTube(
				path.map(([x, y, z]): Vec3 => [x, y, z + railHeight]),
				ribbonProfile.railRadius
			)
		},
		...pathSupports(path, 3.6).map((p, j): Primitive => ({
			...pathSurfaces.guard,
			edges: false,
			id: id + '/post/' + j,
			kind: 'cylinder',
			position: p,
			height: railHeight,
			radius: ribbonProfile.postRadius
		}))
	];
}
function groundLanding(e: MovementEdge, foot: MovementPort | undefined): Primitive[] {
	if (e.kind !== 'path' || foot?.kind !== 'path') return [];
	const [x, y, z] = foot.position;
	const end: Vec3 = [x + 0.5 * Math.cos(foot.heading), y + 0.5 * Math.sin(foot.heading), z];
	return [
		{
			...pathSurfaces.bearing,
			kind: 'prism',
			id: e.id + '/foot',
			polygon: deckCorners([x, y, z], end, e.width).map(([u, v]) => [u, v]),
			z: z - ribbonProfile.depth,
			height: ribbonProfile.depth
		}
	];
}
/** Projects finished walking edges and their junction boundaries in world metres. */
export function ribbonDeck(graph: MovementGraph, ground: Ground, courts: Primitive[]) {
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const support = landingGround(courts, ground);
	const rails = new Map<string, Vec3[][]>();
	function exposed(edge: Vec3[], side: 1 | -1, group = 'town-walk/rail') {
		const row = rails.get(group) ?? [];
		row.push(...guardRuns(edge, support, (p) => p[2], side, ribbonProfile.guardDrop));
		rails.set(group, row);
	}
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
		const parts = deck(e.id, sections, ground, e.kind !== 'tunnel');
		parts.push(...groundLanding(e, ports.get(e.to)));
		return parts;
	});
	for (const p of graph.ports) {
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
			contours(segments).flatMap((p, i) => guard(p, id + '/' + i))
		)
	];
}
