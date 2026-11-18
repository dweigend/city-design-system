import type { Primitive, Vec3 } from '../parametrik/types';
import { chainage, poseAt } from './alignment';
import { DESIGN, SHAFT_OFFSET, type TransitLine, type TransitStop } from './contract';
const surface = { role: 'neu', material: 'concrete' } as const;
const paper = { ...surface, token: '--paper' } as const;
const PLATFORM_DROP = 0.6,
	PLATFORM_HEIGHT = 0.35,
	PLATFORM_RADIUS = 4.5,
	HALO_HEIGHT = 3.4;
const SHAFT_RADIUS = 1.1,
	FOUNDATION_DEPTH = 1.5,
	HOOP_SPACING = 10;
function stopParts(line: TransitLine, stop: TransitStop, id: string): Primitive[] {
	const {
			position: [x, y, z],
			headingRad
		} = stop,
		top = z - PLATFORM_DROP;
	const ground =
		'groundZ' in stop && typeof stop.groundZ === 'number'
			? stop.groundZ
			: z - DESIGN[line.kind].clearance;
	const shaft: Primitive = {
		...surface,
		id: id + '/shaft',
		token: '--cat-business',
		kind: 'cylinder',
		radius: SHAFT_RADIUS,
		height: top - ground,
		position: [
			x - SHAFT_OFFSET * Math.sin(headingRad),
			y + SHAFT_OFFSET * Math.cos(headingRad),
			ground
		]
	};
	if (line.kind === 'capsule')
		return [
			{ ...paper, id, kind: 'sphere', position: [x, y, z], radius: 3.6, squash: 0.72 },
			shaft
		];
	return [
		{
			...paper,
			id,
			kind: 'cylinder',
			position: [x, y, top - PLATFORM_HEIGHT],
			height: PLATFORM_HEIGHT,
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
			token: '--cat-business'
		},
		shaft
	];
}
/** Projects a routed line into detached world-meter primitives, ordered deck, hoops, pillars and
 * stations. Reads the line without mutation. A hand-built stop without a ground survey uses nominal clearance.
 */
export function lineParts(line: TransitLine): Primitive[] {
	const design = DESIGN[line.kind],
		capsule = line.kind === 'capsule';
	const parts: Primitive[] = [
		{
			...surface,
			id: line.id + '/deck',
			kind: 'pipe',
			points: line.path.map((p): Vec3 => [...p]),
			radius: design.deckRadius,
			// Rail and tube carry people: the color of that flow (data/focus.ts).
			token: '--cat-business',
			...(capsule ? { glass: true } : {})
		}
	];
	if (capsule) {
		const distances = chainage(line.path);
		for (let at = 0; at <= line.length; at += HOOP_SPACING) {
			const { position, headingRad } = poseAt(line.path, distances, at);
			parts.push({
				...paper,
				id: line.id + '/hoop/' + at,
				kind: 'torus',
				axis: 'x',
				position,
				rotation: headingRad,
				radius: 1.4,
				tube: 0.1
			});
		}
	}
	line.pillars.forEach(({ foot: [x, y, z], top }, i) => {
		const base = z - FOUNDATION_DEPTH;
		parts.push({
			...paper,
			id: line.id + '/pillar/' + i,
			kind: 'cylinder',
			position: [x, y, base],
			radius: design.supportRadius,
			height: top - base
		});
	});
	line.stops.forEach((stop, i) => parts.push(...stopParts(line, stop, line.id + '/stop/' + i)));
	return parts;
}
