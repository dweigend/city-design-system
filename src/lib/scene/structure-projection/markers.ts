import { defaults } from '../../../config/structure-projection';
import type { Vec3 } from '../../core/geometry';
import type { GravityResult, JointLoad, MemberGraph } from '../../domain/structure';
import { addSegment, mesh } from './mesh';

const markerDefaults = {
	supportWidthM: defaults.supportWidthM,
	supportHeightM: defaults.supportHeightM,
	arrowBaseM: defaults.arrowBaseM,
	arrowReferenceKN: defaults.arrowReferenceKN,
	arrowHeadM: defaults.arrowHeadM,
	arrowWidthM: defaults.arrowWidthM
};

/** Bearing and force marker dimensions in world meters, with a force scale in kN per meter. */
export type MarkerSizing = Readonly<Record<keyof typeof markerDefaults, number>>;

function addArrow(
	shape: ReturnType<typeof mesh>,
	[x, y, z]: Vec3,
	force: number,
	arrow: 'down' | 'up',
	sizing: MarkerSizing
) {
	const direction = arrow === 'up' ? 1 : -1;
	const gap = sizing.arrowHeadM;
	const length = sizing.arrowBaseM + force / sizing.arrowReferenceKN;
	const tip: Vec3 = [x, y, z - direction * gap];
	const neck: Vec3 = [x, y, tip[2] - direction * gap];
	const tail: Vec3 = [x, y, tip[2] - direction * length];
	addSegment(shape, tail, neck, sizing.arrowWidthM);
	for (const offset of [-gap, gap])
		addSegment(shape, [x + offset, y, neck[2]], tip, sizing.arrowWidthM);
}

/** Builds bearing pads and, optionally, downward load and upward reaction arrows. */
export function markers(
	graph: MemberGraph,
	positions: ReadonlyMap<string, Vec3>,
	loads: readonly JointLoad[] = [],
	result?: GravityResult,
	showSupports = true,
	overrides?: Partial<MarkerSizing>
) {
	const sizing = overrides ? { ...markerDefaults, ...overrides } : markerDefaults;
	if (
		overrides &&
		(Object.values(sizing).some((value) => !Number.isFinite(value) || value <= 0) ||
			sizing.arrowBaseM <= sizing.arrowHeadM)
	)
		throw new RangeError('Invalid structural marker dimensions');
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
				[x, y, z - sizing.supportHeightM],
				point,
				sizing.supportWidthM
			);
		}
		const load = applied.get(id);
		if (load) addArrow(parts.load, point, load, 'down', sizing);
		const reaction = reactions.get(id);
		if (reaction)
			addArrow(parts.reaction, [x, y, z - sizing.supportHeightM], reaction, 'up', sizing);
	}
	return parts;
}
