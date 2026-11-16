/**
 * External circulation for the corner modules (form): stair flight (two-flight stair with
 * landings), stair tower (the same inside a strut frame) and spiral stair. Flights as solid wedges
 * in the color of the target with step lines (36: Memphis stair blocks; 43: red towers and
 * spirals). The position (free column, target) comes from eckraster/erschliessung.ts.
 */
import type { ColorToken, Primitive, Vec3 } from '../types';
import type { Point2 } from '../vocab';
import { fitRect, inset } from './geom';

export type TreppenForm = {
	id: string;
	art: 'turm' | 'lauf' | 'wendel';
	/** Outline of the free build cell. */
	outline: Point2[];
	/** Point of the target cell (direction toward the building). */
	toward: Point2;
	/** Height of the exit platform. */
	z: number;
	token: ColorToken;
	/** Height between two drawn step lines in meters; if not given, every step. */
	stufe?: number;
};

const N = { role: 'neu', material: 'concrete' } as const;
const PODEST = 0.3,
	STEIG = 0.19,
	MAX_LAUF = 2.2;

const avg = (ps: Point2[]): Point2 => [
	ps.reduce((s, q) => s + q[0], 0) / ps.length,
	ps.reduce((s, q) => s + q[1], 0) / ps.length
];

export function treppe(t: TreppenForm): Primitive[] {
	const c = avg(t.outline),
		dir = Math.atan2(t.toward[1] - c[1], t.toward[0] - c[0]);
	if (t.z <= 0.5) return [];
	if (t.art === 'wendel') return wendel(t, c, dir);
	// Flights parallel to the facade: u along, v toward the building.
	const a = dir - Math.PI / 2;
	const room = inset(t.outline, 0.15, c);
	const r = fitRect(room, c, a);
	if (r.hu < 1.1 || r.hv < 0.8) return wendel(t, c, dir);
	const cos = Math.cos(a),
		sin = Math.sin(a);
	const at = (u: number, v: number): Point2 => [
		c[0] + (r.cu + u) * cos - (r.cv + v) * sin,
		c[1] + (r.cu + u) * sin + (r.cv + v) * cos
	];
	const p3 = (u: number, v: number, z: number): Vec3 => [...at(u, v), z];
	const out: Primitive[] = [];
	const n = Math.max(2, Math.ceil(t.z / MAX_LAUF)),
		rise = t.z / n,
		ld = Math.min(1.1, r.hu * 0.32),
		half = r.hu - ld,
		w = r.hv - 0.04,
		lines: Vec3[][] = [];
	for (let i = 0; i < n; i++) {
		const up = i % 2 === 0 ? 1 : -1,
			v = (i % 2 === 0 ? -1 : 1) * (r.hv / 2),
			z0 = i * rise,
			z1 = z0 + rise,
			zb = i === 0 ? 0 : z0 - PODEST,
			[cx, cy] = at(0, v);
		// Wedge: full height on local −x (top), hence +x from the upper to the lower end.
		out.push({
			...N,
			id: `${t.id}:lauf:${i}`,
			kind: 'wedge',
			position: [cx - half, cy - w / 2, zb],
			size: [half * 2, w, z1 - zb],
			low: (z0 - zb) / (z1 - zb),
			rotation: up === 1 ? a + Math.PI : a,
			token: t.token
		});
		const steps = Math.max(3, Math.round(rise / (t.stufe ?? STEIG)));
		for (let k = 1; k < steps; k++) {
			const s = k / steps,
				u = up * (-half + 2 * half * s),
				z = z0 + rise * s + 0.01;
			lines.push([p3(u, v - w / 2, z), p3(u, v + w / 2, z)]);
		}
		// Landing at the upper end across both flights.
		const pu = up * (r.hu - ld / 2),
			[px, py] = at(pu, 0);
		out.push({
			...N,
			id: `${t.id}:podest:${i}`,
			kind: 'box',
			position: [px - ld / 2, py - r.hv, z1 - PODEST],
			size: [ld, r.hv * 2, PODEST],
			rotation: a,
			token: t.token
		});
		// Outer handrail (facing away from the building) for flights on the outer lane.
		if (v < 0)
			lines.push([
				p3(-up * half, v - w / 2, z0 + 1),
				p3(up * half, v - w / 2, z1 + 1),
				p3(up * half, v - w / 2, z1)
			]);
	}
	// Exit: footbridge from the topmost landing to the facade.
	const top = (n - 1) % 2 === 0 ? 1 : -1,
		[bx, by] = at(top * (r.hu - ld / 2), r.hv + 0.4);
	out.push({
		...N,
		id: `${t.id}:austritt`,
		kind: 'box',
		position: [bx - ld / 2, by - 0.4, t.z - PODEST],
		size: [ld, 0.8, PODEST],
		rotation: a,
		token: t.token
	});
	if (t.art === 'turm') {
		const storeys = Math.max(1, Math.round(t.z / 4)),
			[fx, fy] = at(0, 0);
		out.push({
			...N,
			id: `${t.id}:geruest`,
			kind: 'frame',
			position: [fx - r.hu - 0.1, fy - r.hv - 0.1, 0],
			size: [r.hu * 2 + 0.2, r.hv * 2 + 0.2, t.z + 1.2],
			cells: [2, 1, storeys],
			bar: 0.14,
			braced: true,
			rotation: a,
			token: t.token,
			material: 'metal'
		});
	} else
		for (const end of [1, -1]) {
			const [sx, sy] = at(end * (r.hu - ld / 2), 0),
				zTop = Math.max(
					0,
					...Array.from({ length: n }, (_, i) => i)
						.filter((i) => (i % 2 === 0 ? 1 : -1) === end)
						.map((i) => (i + 1) * rise - PODEST)
				);
			if (zTop > 0.5)
				out.push({
					...N,
					id: `${t.id}:stuetze:${end}`,
					kind: 'cylinder',
					position: [sx, sy, 0],
					radius: 0.12,
					height: zTop,
					token: '--paper',
					edges: false
				});
		}
	lines.forEach((points, i) =>
		out.push({ ...N, id: `${t.id}:linie:${i}`, kind: 'polyline', points, token: '--paper' })
	);
	return out;
}

/** Spiral stair around a mast, one turn per floor, exit toward the building. */
function wendel(t: TreppenForm, c: Point2, dir: number): Primitive[] {
	const R = 1.7,
		p: Point2 = [c[0] + Math.cos(dir) * 0.6, c[1] + Math.sin(dir) * 0.6];
	return [
		{
			...N,
			id: `${t.id}:mast`,
			kind: 'cylinder',
			position: [p[0], p[1], 0],
			radius: 0.22,
			height: t.z + 1.2,
			token: t.token,
			edges: false
		},
		{
			...N,
			id: `${t.id}:wendel`,
			kind: 'helix',
			position: [p[0], p[1], 0],
			radius: R,
			innerRadius: 0.3,
			height: t.z,
			turns: Math.max(1, t.z / 4),
			thickness: 0.25,
			token: t.token
		},
		{
			...N,
			id: `${t.id}:austritt`,
			kind: 'box',
			position: [p[0] + Math.cos(dir) * 1.6 - 1.1, p[1] + Math.sin(dir) * 1.6 - 0.45, t.z - PODEST],
			size: [2.2, 0.9, PODEST],
			rotation: dir,
			token: t.token
		}
	];
}
