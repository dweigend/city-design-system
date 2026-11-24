import { bounds, size, type Vec3 } from '../../core/geometry';
import { PlaceableObject } from '../../core/object';
import {
	memberSections,
	type GravityResult,
	type JointLoad,
	type MemberGraph
} from '../../domain/structure';
import { resolveSurfaces, type SurfaceAssignment } from '../surface';
import { markerSurfaces, memberAppearance, utilizationBand } from './appearance';
import { markers } from './markers';
import { addSegment, mesh } from './mesh';

/** Structural display choices for the same graph. */
export type StructureView = 'all' | 'primary' | 'utilization';

type Options = Readonly<{
	view?: StructureView;
	analysis?: GravityResult;
	arrows?: readonly JointLoad[];
	supports?: boolean;
	toLocal?: (position: Vec3) => Vec3;
}>;

// Exact arithmetic: +Z faces out of a support seat in ground-aligned metric coordinates.
const supportNormal: Vec3 = [0, 0, 1];
// Exact arithmetic: an empty object occupies zero meters on both ground axes.
const emptyExtents = [0, 0] as const;

function memberBatches(graph: MemberGraph, positions: ReadonlyMap<string, Vec3>, options: Options) {
	const groups = new Map<
		string,
		{ geometry: ReturnType<typeof mesh>; heavy: boolean; band?: number }
	>();
	const utilization =
		options.view === 'utilization'
			? new Map(options.analysis?.members.map(({ id, utilization }) => [id, utilization]))
			: undefined;
	for (const { id, from, to, role, section } of graph.members) {
		const heavy = section === 'heavy';
		if (options.view === 'primary' && !heavy) continue;
		const band = utilizationBand(utilization?.get(id) ?? null);
		const slot = `${role}/${section}/${band ?? 'neutral'}`;
		let group = groups.get(slot);
		if (!group) {
			group = { geometry: mesh(), heavy, band };
			groups.set(slot, group);
		}
		addSegment(
			group.geometry,
			positions.get(from) as Vec3,
			positions.get(to) as Vec3,
			memberSections[section].widthM,
			true
		);
	}
	return groups;
}

/** Projects metric members grouped by role, section and analysis band through the object
 * and surface contracts. Returns fresh drawables without modifying the graph. Support pads
 * are shown by default. Supply scaled joint loads to draw force arrows and reactions. */
export function projectStructure(graph: MemberGraph, options: Options = {}) {
	const positions = new Map(
		graph.joints.map(({ id, position }) => [id, options.toLocal?.(position) ?? position])
	);
	const extents = bounds([...positions.values()]);
	const [width, depth] = extents ? size(extents) : emptyExtents;
	const groups = memberBatches(graph, positions, options);
	const markerParts = markers(
		graph,
		positions,
		options.arrows,
		options.arrows && options.analysis,
		options.supports
	);
	const markersPresent = Object.entries(markerParts).filter(([, shape]) => shape.indices.length);
	const members = Array.from(groups, ([slot, { geometry }]) => [slot, geometry] as const);
	const slots = [...members, ...markersPresent];
	const object = PlaceableObject.create({
		id: 'structural-frame',
		slots: slots.map(([slot]) => slot),
		parts: slots.map(([slot, { positions, indices }]) => ({
			id: `structure/${slot}`,
			slot,
			shape: { kind: 'mesh', positions, indices }
		})),
		footprint: { width, depth },
		anchors: graph.joints
			.filter(({ support }) => support !== 'free')
			.map(({ id }) => ({
				name: id,
				position: positions.get(id) as Vec3,
				normal: supportNormal
			}))
	});
	const assignment: SurfaceAssignment = {
		...Object.fromEntries(
			Array.from(groups, ([slot, { heavy, band }]) => [slot, memberAppearance(heavy, band)])
		),
		...Object.fromEntries(
			markersPresent.map(([slot]) => [slot, markerSurfaces[slot as keyof typeof markerSurfaces]])
		)
	};
	return resolveSurfaces(object, assignment).map((part, i) => ({
		...part,
		...(i < members.length && { strokeSegments: members[i][1].segments })
	}));
}
