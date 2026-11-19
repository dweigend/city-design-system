import { bounds, union } from '../ansicht/geometrie';
import type { Solid } from '../house-typology';
import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import { members } from './provider';
import { place } from './asset-fit';
import { houseObject, type HousePart } from './house-object';
import type { HouseSurfaces } from './surfaces';
import { pipeBetween } from './parts';

function bearing(s: Section, p: Extract<Solid, { kind: 'box' }>, surfaces: HouseSurfaces) {
	const socket = p.joint === 'socket';
	const id = socket
		? 'kit-capsule-cradle-2p5m'
		: 'kit-column-' + p.joint + (p.joint === 'shaft' ? '-2m' : '-0p5m');
	const stock = members(id, socket ? 'shallow' : 'light', s.seed, p.id, surfaces);
	const box = union(stock.map(bounds));
	const scale = p.size.map((v, i) => v / (box.max[i] - box.min[i])) as Vec3;
	return place(stock, box.min, p.position, scale, 0);
}
function floor(s: Section, p: Solid, surfaces: HouseSurfaces): HousePart {
	const stock = houseObject('primitive-slab', 'square', s.seed, {
		instanceId: p.id,
		slots: { body: surfaces.deck }
	}).parts[0];
	if (stock.kind !== 'prism') throw new Error('Expected slab stock');
	const level = s.composition.levels.find(
		(l) => Math.abs(l.position[2] - ('position' in p ? p.position[2] : 0) - p.size[2]) < 1e-8
	);
	const [w, d, h] = p.size;
	if (p.kind === 'prism')
		return {
			...stock,
			id: p.id,
			polygon: p.polygon,
			holes: p.holes,
			z: p.z,
			height: p.height,
			roofCell: s.cells[0].id
		};
	if (p.kind !== 'box' && p.kind !== 'cylinder') throw new Error('Expected floor');
	const [x, y, z] = p.position;
	const polygon: [number, number][] =
		p.kind === 'cylinder' && level
			? level.outline.map(([u, v]) => [u, v])
			: [
					[x, y],
					[x + w, y],
					[x + w, y + d],
					[x, y + d]
				];
	return { ...stock, id: p.id, polygon, z, height: h, roofCell: s.cells[0].id };
}
/** Fits manufactured columns and sockets to their surveyed joints, and cuts plates to their outlines. */
export function houseStructure(s: Section, surfaces: HouseSurfaces): HousePart[] {
	return s.composition.parts.flatMap((p): HousePart[] => {
		if (p.joint === 'deck') return [floor(s, p, surfaces)];
		if (p.joint === 'brace' && p.kind === 'mesh') {
			const centre = (i: number): Vec3 =>
				p.points[i].map((v, k) => (v + p.points[i + 2][k]) / 2) as Vec3;
			const lower = centre(0),
				upper = centre(4);
			const radius = Math.min(p.size[1] / 2, (upper[2] - lower[2]) / 2);
			const inset = radius / (upper[2] - lower[2]);
			const at = (t: number): Vec3 => lower.map((v, k) => v + t * (upper[k] - v)) as Vec3;
			return [pipeBetween(p.id, at(inset), at(1 - inset), radius, surfaces.frame)];
		}
		if (p.kind === 'box' && ['socket', 'foot', 'shaft', 'head'].includes(p.joint))
			return bearing(s, p, surfaces);
		return [];
	});
}
