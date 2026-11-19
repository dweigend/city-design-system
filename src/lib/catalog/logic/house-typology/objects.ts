import { buildObject } from '../assets';
import { bounds, union } from '../ansicht/geometrie';
import type { HouseSlot } from './site';
import type { Body, Point, Joint, Block } from './types';
type ObjectSpec = readonly [string, string, HouseSlot['kind']];
const crowns: Record<Body['use'], ObjectSpec> = {
	living: ['dome', 'saucer', 'dome'],
	energy: ['kit-crown-solar-sail-5m', 'four-panel', 'panels'],
	water: ['stepped-pools', 'compact', 'reservoir'],
	food: ['grove-island', 'compact', 'grove'],
	material: ['kit-crown-pergola-3p75m', 'low', 'workshop']
};
/** Chooses the roof installation by its upper painted use. */
export function crownSpec(use: Body['use'], small = false): ObjectSpec {
	if (!small) return crowns[use];
	return use === 'energy'
		? ['kit-crown-solar-sail-2p5m', 'two-panel', 'panels']
		: ['primitive-dome', 'long', 'dome'];
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
