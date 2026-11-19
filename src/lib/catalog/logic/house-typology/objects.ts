import { buildObject } from '../assets';
import { bounds, union } from '../ansicht/geometrie';
import type { HouseSlot } from './site';
import type { Body, Point, Joint, Block } from './types';
import type { Typology } from './families';
type ObjectSpec = readonly [string, string, HouseSlot['kind']];
const crowns: Record<Typology, ObjectSpec> = {
	'capsule-stack': ['kit-crown-lantern-2p5m', 'standard', 'lantern'],
	'deck-tower': ['kit-crown-solar-sail-2p5m', 'two-panel', 'panels'],
	'round-tower': ['observatory', 'slit-dome', 'lookout'],
	'portal-house': ['green-roof', 'strip-garden', 'grove'],
	'lattice-head': ['lattice-mast', 'compact', 'lookout'],
	'courtyard-house': ['green-roof', 'meadow-islands', 'grove'],
	'terrace-house': ['glass-bell', 'cloche', 'dome'],
	'plinth-house': ['shed-cap', 'standard', 'workshop'],
	'cluster-mast': ['pin-crown', 'standard', 'lantern'],
	rack: ['shed-cap', 'compact', 'workshop'],
	'bridge-house': ['garden-loggia', 'extended', 'grove'],
	'bell-house': ['glass-bell', 'hothouse', 'dome'],
	'twin-stack': ['ridge-lantern', 'extended', 'lantern'],
	'slab-house': ['spire-cap', 'compact', 'chimney'],
	'water-house': ['water-tower', 'elevated-bowl', 'reservoir'],
	'tree-house': ['grove-island', 'extended', 'grove']
};
export function crownSpec(type: Typology, small = false): ObjectSpec {
	if (!small) return crowns[type];
	if (type === 'water-house') return ['wall-cistern', 'compact', 'reservoir'];
	if (type === 'bell-house') return ['glass-bell', 'cloche', 'dome'];
	if (type === 'plinth-house') return ['cowl-vent', 'compact', 'chimney'];
	return ['ring-beacon', 'compact', 'lantern'];
}
export function bodySpec(
	type: Typology,
	use: HouseSlot['use'],
	length: number,
	level: number
): ObjectSpec {
	if (use === 'living')
		return [
			'kit-capsule-ribbon-' + String(length).replace('.', 'p') + 'm',
			'round-shoulder',
			'capsule'
		];
	if (type === 'round-tower') return ['drum-house', 'extended', 'lookout'];
	if (type === 'courtyard-house') return ['gallery-bar', 'standard', 'workshop'];
	if (type === 'bell-house')
		return level === 0
			? ['tank-capsule', 'cistern', 'reservoir']
			: ['glass-bell', 'hothouse', 'dome'];
	if (type === 'water-house' && level === 0) return ['tank-capsule', 'header', 'reservoir'];
	if (use === 'water') return ['tank-capsule', 'pressure-vessel', 'reservoir'];
	if (use === 'food') return ['grove-island', 'extended', 'grove'];
	if (type === 'bridge-house' || type === 'portal-house')
		return ['gallery-bar', 'standard', 'workshop'];
	return ['plug-box', 'extended', use === 'energy' ? 'solar' : 'workshop'];
}
/** Measures the selected registry variant before fitting. The resulting transform is a translation, yaw and one scalar. */
export function objectSlot(
	id: string,
	spec: ObjectSpec,
	use: HouseSlot['use'],
	seed: number,
	rotation: number,
	module?: number
): Body {
	const [objectId, variant, kind] = spec;
	const box = union(buildObject(objectId, variant, seed).parts.map(bounds));
	const nativeSize = box.max.map((v, i) => v - box.min[i]) as Point;
	const nativeCenter: Point = [
		(box.min[0] + box.max[0]) / 2,
		(box.min[1] + box.max[1]) / 2,
		box.min[2]
	];
	let scale = 1;
	if (module) scale = Math.max(0.85, Math.min(1.15, module / nativeSize[0], 2.5 / nativeSize[1]));
	const size = nativeSize.map((d) => d * scale) as Point;
	return {
		id,
		objectId,
		variant,
		seed,
		kind,
		use,
		nativeSize,
		nativeCenter,
		rotation,
		scale,
		size,
		...(module ? { bay: [module, 2.5] as [number, number] } : {}),
		position: [0, 0, 0],
		facing: [0, 1],
		anchor: 'deck'
	};
}
/** Creates a physical assembly envelope in world metres from its bottom centre. */
export function solid(
	id: string,
	joint: Joint,
	[x, y, z]: Point,
	size: Point,
	ground: number,
	slot: string
): Block {
	return {
		id,
		joint,
		ground,
		slot,
		kind: 'box',
		role: 'neu',
		position: [x - size[0] / 2, y - size[1] / 2, z],
		size
	};
}
export function worldSize(body: Body): Point {
	const [w, d, h] = body.size;
	return Math.abs(Math.sin(body.rotation)) > 0.5 ? [d, w, h] : [w, d, h];
}
export function mounted(body: Body, ground: number, joint: Joint): Block {
	const scale: Point = [body.scale, body.scale, body.scale];
	return {
		...solid(body.id, joint, body.position, worldSize(body), ground, body.use),
		source: { objectId: body.objectId, variant: body.variant },
		nativeSize: worldSize({ ...body, size: body.nativeSize }),
		scale
	};
}
