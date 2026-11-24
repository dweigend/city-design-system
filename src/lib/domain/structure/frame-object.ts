import { required } from '../../core/invariant';
import type { Vec3 } from '../../core/geometry';
import { createMeshObject, mesh, squareSegment, type Mesh } from '../../core/mesh';
import { memberSections, type MemberGraph } from './graph';

/** An optional addressed subset and coordinate mapping for a frame object. */
export type FrameBayOptions = Readonly<{
	memberIds?: readonly string[];
	toLocal?: (position: Vec3, id: string) => Vec3;
}>;

// Exact arithmetic: the unit normal points up at the support seat.
const up: Vec3 = /* Exact arithmetic: positive Z axis. */ [0, 0, 1];

/** Builds square-profile members in graph order and preserves selected support anchors.
 * Unknown member addresses throw RangeError. */
export function createFrameBayObject(
	id: string,
	graph: MemberGraph,
	{ memberIds, toLocal }: FrameBayOptions = {}
) {
	const wanted = memberIds && new Set(memberIds);
	const members = wanted ? graph.members.filter((member) => wanted.has(member.id)) : graph.members;
	if (wanted && wanted.size !== members.length)
		throw new RangeError('Unknown frame member address');
	const positions = new Map(
		graph.joints.map(({ id, position }) => [id, toLocal?.(position, id) ?? position])
	);
	const layers: Record<string, Mesh> = {};
	const joints = new Set(members.flatMap(({ from, to }) => [from, to]));
	for (const { from, to, role, section } of members) {
		const slot = `${role}/${section}`;
		layers[slot] ??= mesh();
		const a = positions.get(from);
		const b = positions.get(to);
		if (!a || !b) throw new RangeError('Missing member joint');
		layers[slot].append(squareSegment(a, b, memberSections[section].widthM));
	}
	const anchors = graph.joints
		.filter(({ id, support }) => support !== 'free' && (!wanted || joints.has(id)))
		.map(({ id }) => ({
			name: id,
			position: required(positions.get(id), 'frame anchor'),
			normal: up
		}));
	return createMeshObject(id, layers, anchors);
}
