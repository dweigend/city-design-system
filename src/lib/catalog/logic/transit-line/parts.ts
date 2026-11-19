import type { Primitive, Vec3 } from '../parametrik/types';
import { chainage, poseAt } from './alignment';
import {
	CAPSULE_HOOP_RADIUS,
	resolveTransitProfile,
	type TransitProfile,
	type TransitLine,
	type TransitStop
} from './contract';
import { drawingTransitSlots, type TransitSlots } from './slots';
const surface = { role: 'neu', material: 'concrete' } as const;

const PLATFORM_RADIUS = 4.5,
	HALO_HEIGHT = 3.4;
const SHAFT_RADIUS = 1.1,
	FOUNDATION_DEPTH = 1.5;
function stopParts(
	line: TransitLine,
	stop: TransitStop,
	id: string,
	profile: TransitProfile,
	slots: TransitSlots
): Primitive[] {
	const {
			position: [x, y, z],
			headingRad
		} = stop,
		top = z - profile.platformDrop;
	const ground =
		'groundZ' in stop && typeof stop.groundZ === 'number' ? stop.groundZ : z - profile.clearance;
	const shaft: Primitive = {
		...surface,
		id: id + '/shaft',
		...slots.shaft,
		member: 'primary',
		kind: 'cylinder',
		radius: SHAFT_RADIUS,
		height: top - ground,
		position: [
			x - profile.shaftOffset * Math.sin(headingRad),
			y + profile.shaftOffset * Math.cos(headingRad),
			ground
		]
	};
	if (line.kind === 'capsule')
		return [
			{
				...surface,
				...slots.platform,
				id,
				kind: 'sphere',
				position: [x, y, z],
				radius: 3.6,
				squash: 0.72
			},
			shaft
		];
	return [
		{
			...surface,
			...slots.platform,
			id,
			kind: 'cylinder',
			position: [x, y, top - profile.platformHeight],
			height: profile.platformHeight,
			radius: PLATFORM_RADIUS
		},
		{
			...surface,
			id: id + '/halo',
			kind: 'torus',
			axis: 'z',
			position: [x, y, top + HALO_HEIGHT],
			radius: PLATFORM_RADIUS,
			tube: 0.16,
			...slots.halo
		},
		shaft
	];
}
/** Projects a routed line into detached world-meter primitives, ordered deck, hoops, pillars and
 * stations. Invalid profile overrides throw RangeError. A stop without a ground survey uses nominal clearance.
 * The line is read without mutation.
 */
export function lineParts(
	line: TransitLine,
	slots: TransitSlots = drawingTransitSlots
): Primitive[] {
	const design = resolveTransitProfile(line.kind, line.profile),
		capsule = line.kind === 'capsule';
	const parts: Primitive[] = [
		{
			...surface,
			id: line.id + '/deck',
			kind: 'pipe',
			points: line.path.map((p): Vec3 => [...p]),
			radius: design.deckRadius,
			...(capsule ? slots.glass : slots.deck),
			...(capsule ? { glass: true } : {})
		}
	];
	if (capsule) {
		const distances = chainage(line.path);
		for (let at = 0; at <= line.length; at += design.hoopSpacing) {
			const { position, headingRad } = poseAt(line.path, distances, at);
			parts.push({
				...surface,
				...slots.hoop,
				id: line.id + '/hoop/' + at,
				kind: 'torus',
				axis: 'x',
				position,
				rotation: headingRad,
				radius: CAPSULE_HOOP_RADIUS,
				tube: 0.1
			});
		}
	}
	line.pillars.forEach(({ foot: [x, y, z], top }, i) => {
		const base = z - FOUNDATION_DEPTH;
		parts.push({
			...surface,
			...slots.pillar,
			id: line.id + '/pillar/' + i,
			member: 'primary',
			bearings: [[x, y, z]],
			kind: 'cylinder',
			position: [x, y, base],
			radius: design.supportRadius,
			height: top - base
		});
	});
	line.stops.forEach((stop, i) =>
		parts.push(...stopParts(line, stop, line.id + '/stop/' + i, design, slots))
	);
	return parts;
}
