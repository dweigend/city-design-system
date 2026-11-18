import { STORY } from '../../data/grid';
import { flowToken } from '../../data/focus';
import { inradius, sideLength, type QuadCell } from '../quad-grid';
import type { Primitive } from '../parametrik/types';
import { bayOf, panel, type Bay } from './collage-bay';
import { accentOf, part } from './form';
import type { Mass } from './massing';

/** A suspended flight climbing across the section to the roof landing. */
function stairs(id: string, at: Bay, z: number, r: number): Primitive[] {
	return Array.from({ length: 8 }, (_, i) =>
		part(id + ':step' + i, flowToken.people, {
			kind: 'prism',
			polygon: panel(at, -1.15 + i * 0.2, 0.1, 0.201, 0.45, z).map(([x, y]) => [x, y]),
			z: z + (i - 5) * r * 0.21,
			height: r * 0.22,
			edges: false
		})
	);
}

/** One cutout, oriented along the selected side and sized in units of its carrier bay. */
export function collageFigure(
	mass: Mass,
	cell: QuadCell,
	side: number,
	p: { treeRadius: number; treeHeight: number; gardenDepth: number }
): Primitive[] {
	const at = bayOf(cell, side),
		r = inradius(cell),
		z = mass.floor + STORY,
		id = mass.id + ':figure';
	const span = Math.sqrt(sideLength(cell, side) * r);
	const token = accentOf(mass.use) ?? '--paper';
	const [a, b] = panel(at, 0, 0, 1, 1, z);
	switch (mass.use) {
		case 'living':
			return stairs(id, at, z, span);
		case 'water':
			return [
				part(id, token, {
					kind: 'sphere',
					position: at(0.78, 0.38, z + r * 0.74),
					radius: r * 1.42
				})
			];
		case 'energy':
			return [
				part(id, token, {
					kind: 'ring',
					position: at(0.48, 0.44, z + span * 0.78),
					radius: span * 1.05,
					innerRadius: span * 0.24,
					depth: r * 0.11,
					edges: false,
					tilt: 0.65,
					rotation: Math.atan2(b[1] - a[1], b[0] - a[0])
				})
			];
		case 'food': {
			const bed = z + r * p.treeHeight;
			const planter = part(id + ':garden', token, {
				kind: 'prism',
				polygon: panel(at, -0.3, 0.1, 1.35, 0.8, bed).map(([x, y]) => [x, y]),
				z: bed,
				height: r * p.gardenDepth
			});
			const trees = [0, 0.5, 1].flatMap((u, i) => {
				const fruit = at(u, 0.5, bed + r * p.treeHeight);
				return [
					part(id + ':stem' + i, '--paper', { kind: 'polyline', points: [at(u, 0.5, bed), fruit] }),
					part(id + ':fruit' + i, token, {
						kind: 'sphere',
						position: fruit,
						radius: r * p.treeRadius
					})
				];
			});
			return [planter, ...trees];
		}
		case 'material':
			return [
				part(id, token, {
					kind: 'pipe',
					points: [
						at(-0.48, 0.58, z - r * 0.36),
						at(0.65, 0.58, z - r * 0.36),
						at(0.65, 0.58, z + r * 0.8),
						at(1.24, 0.58, z + r * 0.8)
					],
					radius: r * 0.24
				})
			];
	}
}
