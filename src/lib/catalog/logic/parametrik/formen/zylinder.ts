import type { Primitive } from '../types';
import type { Kit } from './kit';
import { family, spec } from './kit';

/** Crown on a round body: 0 flat, 1 cone, 2 dome. */
function cap(
	k: Kit,
	u: number,
	v: number,
	z: number,
	r: number,
	type: number,
	rank: number
): Primitive[] {
	if (type === 1) return [k.cone(u, v, z, r * 1.08, r * 1.1, k.tone(2), { rank })];
	if (type === 2) return [k.dome(u, v, z, r, r * 0.8, 0, k.tone(2), { rank })];
	return [k.cylinder(u, v, z, r * 1.06, 0.35, '--paper', { rank })];
}

/** Cylinder: silo, round tower, half cylinder (06, 18, 21, R04-06). */
export const zylinder = [
	family({
		id: 'zylinder-silo',
		name: 'Silo with crown',
		group: 'zylinder',
		refs: ['18', '21', 'R04-06', 'r3-03'],
		params: [
			spec('radius', 'Radius share', 0.3, 1, 0.05, 0.75),
			spec('hoehe', 'Height', 0.2, 1, 0.05, 0.7),
			spec('kopf', 'Crown (flat, cone, dome)', 0, 2, 1, 1)
		],
		build(k, p) {
			const r = k.radius * p.radius * 0.95,
				capH = p.kopf === 1 ? r * 1.1 : p.kopf === 2 ? r * 0.8 : 0.35,
				h = Math.max(1, k.ctx.height * p.hoehe - capH);
			// Center of the cell, not of the fitted rectangle.
			return [
				k.cylinder(k.ou, k.ov, k.ctx.z, r, h, k.tone(0), { rank: 0 }),
				...cap(k, k.ou, k.ov, k.ctx.z + h, r, p.kopf, 1)
			];
		}
	}),
	family({
		id: 'zylinder-buendel',
		name: 'Silo bundle',
		group: 'zylinder',
		refs: ['06', 'R04-06', '36'],
		params: [
			spec('anzahl', 'Count', 2, 5, 1, 3),
			spec('spiel', 'Height variation', 0, 1, 0.05, 0.6),
			spec('kopf', 'Crown (flat, cone, dome)', 0, 2, 1, 0)
		],
		build(k, p) {
			const out: Primitive[] = [];
			const n = p.anzahl,
				// Circles on a ring around the center, radius so neighbors touch.
				ring = n === 1 ? 0 : Math.min(k.hu, k.hv) * 0.5,
				r =
					n === 1
						? Math.min(k.hu, k.hv)
						: Math.min(Math.min(k.hu, k.hv) - ring, ring * Math.sin(Math.PI / n));
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + k.rng() * 0.3,
					u = Math.cos(a) * ring,
					v = Math.sin(a) * ring,
					h = k.ctx.height * (1 - p.spiel * k.rng() * 0.7) * 0.8;
				out.push(
					k.cylinder(u, v, k.ctx.z, r * 0.96, h, i === 0 ? k.tone(0) : k.tone(i % 2), { rank: 0 })
				);
				out.push(...cap(k, u, v, k.ctx.z + h, r * 0.96, p.kopf, 1));
			}
			return out;
		}
	}),
	family({
		id: 'zylinder-halbturm',
		name: 'Half cylinder against a slab',
		group: 'zylinder',
		refs: ['24', '12'],
		params: [
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.75),
			spec('scheibe', 'Slab m', 0.4, 3, 0.1, 1.2),
			spec('zweiter', 'Second half cylinder', 0, 1, 1, 1)
		],
		build(k, p) {
			const H = k.ctx.height * p.hoehe,
				t = Math.min(p.scheibe, k.hv * 0.6),
				r = Math.max(0.5, Math.min(k.hu, k.hv - t / 2));
			// Wall slab along local x; half cylinders lean against both faces.
			const half = (side: 1 | -1, h: number, token: ReturnType<Kit['tone']>) => {
				const pts: [number, number][] = [];
				for (let i = 0; i <= 24; i++) {
					const a = (i / 24) * Math.PI;
					pts.push(k.world(Math.cos(a) * r, side * (t / 2 + Math.sin(a) * r)));
				}
				return k.prism(pts, k.ctx.z, h, token, { rank: 1 });
			};
			const out = [
				k.box(-k.hu, -t / 2, k.ctx.z, k.hu * 2, t, H, k.tone(1), { rank: 0 }),
				half(1, H * 0.86, k.tone(0))
			];
			if (p.zweiter) out.push(half(-1, H * 0.55, k.tone(2)));
			return out;
		}
	})
];
