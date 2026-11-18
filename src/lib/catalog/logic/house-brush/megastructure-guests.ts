import { STORY } from '../../data/grid';
import type { Primitive, Vec3 } from '../parametrik/types';
import { planen } from '../traeger';
import type { Bay } from './megastructure-bay';
import type { HouseUse } from './stacks';

const mast = planen('raumfachwerk', { phase: 0 });
const span =
	Math.max(...mast.knoten.map((n) => n.p[0])) - Math.min(...mast.knoten.map((n) => n.p[0]));

/** Three feet spread the mooring load beneath one tethered gas cell. */
export function aerostat(b: Bay): Primitive[] {
	const base = b.point(0.5, 0.5, 1),
		scale = (b.radius * 2.3) / span;
	const nodes = new Map(
		mast.knoten.map((n) => [n.id, n.p.map((x, i) => base[i] + scale * x) as Vec3])
	);
	const feet = mast.kanten.flatMap((edge) => {
		const a = nodes.get(edge.a),
			z = nodes.get(edge.b);
		return a && z
			? [b.piece(edge.id, '--signal', { kind: 'pipe', points: [a, z], radius: 0.065 * b.gauge })]
			: [];
	});
	const peak = [...nodes.values()].sort((a, z) => z[2] - a[2])[0];
	const balloon: Vec3 = [peak[0], peak[1], peak[2] + b.radius * 1.12];
	return [
		...feet,
		b.piece('envelope', '--paper', {
			kind: 'sphere',
			position: balloon,
			radius: b.radius * 1.45,
			squash: 0.78
		})
	];
}

function salvage(b: Bay, z: number) {
	const r = b.gauge;
	const panels = Array.from({ length: 3 }, (_, i) =>
		b.piece(`salvage-${i}`, b.token, {
			kind: 'prism',
			polygon: [
				[0.12, 0.16 + i * 0.23],
				[0.96, 0.16 + i * 0.23],
				[0.96, 0.36 + i * 0.23],
				[0.12, 0.36 + i * 0.23]
			].map(([u, v]) => {
				const [x, y] = b.point(u, v, 0);
				return [x, y];
			}),
			z: z - 0.45 * r,
			height: r * (0.7 + i * 0.17)
		})
	);
	return panels;
}

/** Program-specific removable bodies hang from a short central hanger. */
export function guest(b: Bay, use: HouseUse, side: number, exposed: boolean): Primitive[] {
	const r = b.gauge;
	const mid = b.point(0.5, 0.5, 0.49);
	const raisedTank = exposed && use === 'water';
	if (raisedTank) mid[2] += STORY * 0.51 + 1.25 * b.radius;
	const hanger = b.piece('hanger', '--signal', {
		kind: 'pipe',
		points: [mid, b.point(0.5, 0.5, 1)],
		radius: r * 0.11
	});
	if (use === 'material') return [hanger, ...salvage(b, mid[2])];
	if (use === 'water' || use === 'food')
		return [
			hanger,
			{
				...b.piece('vessel', b.token, {
					kind: 'sphere',
					position: mid,
					radius: raisedTank ? b.radius * 1.12 : r * 0.96,
					squash: use === 'food' ? 0.73 : 1
				}),
				material: use === 'food' ? 'greenhouse' : 'glaze',
				glass: use === 'food'
			}
		];
	const [a, c] =
		side % 2
			? [b.point(0.5, 0.2, 0.49), b.point(0.5, 0.8, 0.49)]
			: [b.point(0.2, 0.5, 0.49), b.point(0.8, 0.5, 0.49)];
	return [
		hanger,
		b.piece('cartridge', b.token, {
			kind: 'capsule',
			from: a,
			to: c,
			radius: Math.min(0.9 * r, STORY * 0.31)
		})
	];
}
