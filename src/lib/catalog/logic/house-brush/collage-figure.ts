import { STORY } from '../../data/grid';
import { flowToken } from '../../data/focus';
import { inradius, sideLength, type QuadCell } from '../quad-grid';
import type { Primitive } from '../parametrik/types';
import { bayOf, panel, type Bay } from './collage-bay';
import { accentOf, part } from './form';
import type { Mass } from './massing';

const FIXTURE = {
	tankRadius: 0.49,
	dishRadius: 0.56,
	dishHub: 0.2,
	mastHeight: 1.65,
	dishDepth: 0.06,
	glaze: 0.04
};

/** A suspended flight climbing across the section to the roof landing. */
function stairs(id: string, at: Bay, z: number, r: number): Primitive[] {
	const steps = 8;
	const start = -1.15;
	const run = 0.2;
	const tread = 0.201;
	const width = 0.45;
	const side = 0.1;
	const stepZ = (i: number) => z + (i - 5) * r * 0.21;
	const end = start + (steps - 1) * run + tread;
	const city: [Vec3, Vec3, Vec3, Vec3] = [
		at(start, side, stepZ(0)),
		at(end, side, stepZ(steps - 1)),
		at(end, side + width, stepZ(steps - 1)),
		at(start, side + width, stepZ(0))
	];
	return Array.from({ length: steps }, (_, i) =>
		part(id + ':step' + i, flowToken.people, {
			kind: 'prism',
			polygon: panel(at, start + i * run, side, tread, width, z).map(([x, y]) => [x, y]),
			z: stepZ(i),
			cityForm: i === 0 ? city : false,
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
	const base = at(0.5, 0.5, z);
	const mount = at(0.5, 0.5, z + r * FIXTURE.mastHeight);
	const pedestal = {
		...part(id + ':mast', '--paper', { kind: 'polyline', points: [base, mount] }),
		role: 'bestand' as const
	};
	switch (mass.use) {
		case 'living':
			return stairs(id, at, z, span);
		case 'water':
			return [
				pedestal,
				part(id, token, {
					kind: 'sphere',
					position: at(0.5, 0.5, mount[2] + r * FIXTURE.tankRadius),
					radius: r * FIXTURE.tankRadius,
					edges: false,
					shade: FIXTURE.glaze
				})
			];
		case 'energy':
			return [
				pedestal,
				part(id, token, {
					kind: 'ring',
					position: mount,
					radius: r * FIXTURE.dishRadius,
					innerRadius: r * FIXTURE.dishRadius * FIXTURE.dishHub,
					depth: r * FIXTURE.dishDepth,
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
				edges: false,
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
