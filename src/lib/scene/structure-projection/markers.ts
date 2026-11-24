import { defaults } from '../../../config/structure-projection';
import type { Vec3 } from '../../core/geometry';
import type { GravityResult, JointLoad, MemberGraph } from '../../domain/structure';
import { addSegment, mesh } from './mesh';

function addArrow(
	shape: ReturnType<typeof mesh>,
	[x, y, z]: Vec3,
	force: number,
	arrow: 'down' | 'up'
) {
	const direction = arrow === 'up' ? 1 : -1;
	const gap = defaults.arrowHeadM;
	const length = defaults.arrowBaseM + force / defaults.arrowReferenceKN;
	const tip: Vec3 = [x, y, z - direction * gap];
	const neck: Vec3 = [x, y, tip[2] - direction * defaults.arrowHeadM];
	const tail: Vec3 = [x, y, tip[2] - direction * length];
	addSegment(shape, tail, neck, defaults.arrowWidthM);
	for (const offset of [-gap, gap])
		addSegment(shape, [x + offset, y, neck[2]], tip, defaults.arrowWidthM);
}

/** Builds bearing pads and, optionally, downward load and upward reaction arrows. */
export function markers(
	graph: MemberGraph,
	positions: ReadonlyMap<string, Vec3>,
	loads: readonly JointLoad[] = [],
	result?: GravityResult,
	showSupports = true
) {
	const parts = {
		'pinned-support': mesh(),
		'fixed-support': mesh(),
		load: mesh(),
		reaction: mesh()
	};
	const applied = new Map(loads.map(({ joint, forceKN }) => [joint, forceKN]));
	const reactions = new Map(result?.reactions.map(({ joint, forceKN }) => [joint, forceKN]));
	for (const { id, support } of graph.joints) {
		const point = positions.get(id) as Vec3;
		const [x, y, z] = point;
		if (showSupports && support !== 'free') {
			addSegment(
				parts[`${support}-support`],
				[x, y, z - defaults.supportHeightM],
				point,
				defaults.supportWidthM
			);
		}
		const load = applied.get(id);
		if (load) addArrow(parts.load, point, load, 'down');
		const reaction = reactions.get(id);
		if (reaction) addArrow(parts.reaction, [x, y, z - defaults.supportHeightM], reaction, 'up');
	}
	return parts;
}
