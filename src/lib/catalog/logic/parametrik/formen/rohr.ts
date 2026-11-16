import type { Primitive, Vec3 } from '../types';
import { family, spec } from './kit';
import { flowToken } from '../../../data/focus';

/** Lines carry flows: every tube in the color of its flow (meaning contract). */
const STROM = [flowToken.water, flowToken.energy, flowToken.food, flowToken.material] as const;

/** Pipe: line bundle, tube transit, kinked line (21, 27, 30, 33, 39, 47). */
export const rohr = [
	family({
		id: 'rohr-buendel',
		name: 'Line bundle',
		group: 'rohr',
		refs: ['39', '47', 'r3-03', 'A'],
		params: [
			spec('anzahl', 'Lines', 1, 4, 1, 3),
			spec('radius', 'Radius m', 0.15, 0.8, 0.05, 0.35),
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.8)
		],
		build(k, p) {
			const out: Primitive[] = [],
				top = k.ctx.z + k.ctx.height * p.hoehe,
				gap = p.radius * 2.4;
			for (let i = 0; i < p.anzahl; i++) {
				const o = (i - (p.anzahl - 1) / 2) * gap;
				// Up the back edge, across, down the front: one bend per corner (A, 39).
				const pts: Vec3[] = [
					[-k.hu + 0.8, o, k.ctx.z],
					[-k.hu + 0.8, o, top - 1 - i * gap],
					[-k.hu + 1.6, o, top - i * gap],
					[k.hu - 1.6, o, top - i * gap],
					[k.hu - 0.8, o, top - 1 - i * gap],
					[k.hu - 0.8, o, k.ctx.z]
				];
				out.push(
					k.pipe(pts, p.radius, STROM[i % STROM.length], {
						rank: 0,
						stretchRank: 1,
						material: 'metal'
					})
				);
			}
			const w = p.anzahl * gap + 0.6;
			for (const u of [-k.hu + 0.8, k.hu - 0.8])
				out.push(
					k.box(u - 0.9, -w / 2, k.ctx.z, 1.8, w, 1.2, '--paper', { rank: 0, material: 'metal' })
				);
			return out;
		}
	}),
	family({
		id: 'rohr-roehrenbahn',
		name: 'Tube transit',
		group: 'rohr',
		refs: ['21', '30', '27'],
		params: [
			spec('hoehe', 'Elevation', 0.2, 0.9, 0.05, 0.5),
			spec('radius', 'Radius m', 0.8, 3, 0.1, 1.6),
			spec('kapsel', 'Capsule inside', 0, 1, 1, 1)
		],
		build(k, p) {
			const z = k.ctx.z + Math.max(p.radius, (k.ctx.height - p.radius) * p.hoehe),
				out: Primitive[] = [];
			for (const u of z - p.radius - k.ctx.z > 0.001 ? [-k.hu * 0.55, k.hu * 0.55] : [])
				out.push(
					k.box(u - 0.4, -0.4, k.ctx.z, 0.8, 0.8, z - p.radius - k.ctx.z, k.tone(1), { rank: 0 })
				);
			out.push(
				k.pipe(
					[
						[-k.hu, 0, z],
						[k.hu, 0, z]
					],
					p.radius,
					flowToken.people,
					{ rank: 1, glass: true }
				)
			);
			if (p.kapsel)
				out.push(
					k.capsule([-k.hu * 0.35, 0, z], [k.hu * 0.2, 0, z], p.radius * 0.62, k.tone(0), {
						rank: 1
					})
				);
			return out;
		}
	}),
	family({
		id: 'rohr-knick',
		name: 'Kinked line',
		group: 'rohr',
		refs: ['33', '39', '31'],
		params: [
			spec('knicke', 'Bends', 1, 5, 1, 3),
			spec('radius', 'Radius m', 0.2, 1, 0.05, 0.5),
			spec('stuetzen', 'Supports', 0, 1, 1, 1)
		],
		build(k, p) {
			// Orthogonal routing over the cell; elbows as pipe corners, elbows as balls.
			const pts: Vec3[] = [[-k.hu, -k.hv * 0.6, k.ctx.z + p.radius]];
			let [u, v, z] = pts[0];
			for (let i = 0; i < p.knicke; i++) {
				const t = (i + 1) / (p.knicke + 1);
				if (i % 2 === 0) {
					z = k.ctx.z + p.radius + (k.ctx.height - 2 * p.radius) * (0.35 + 0.6 * k.rng());
					pts.push([u, v, z]);
				} else {
					v = (k.rng() - 0.5) * k.hv * 1.4;
					pts.push([u, v, z]);
				}
				u = -k.hu + 2 * k.hu * t;
				pts.push([u, v, z]);
			}
			pts.push([k.hu, v, z]);
			const out: Primitive[] = [];
			// Straight segments as separate pipes keep corners crisp.
			for (let i = 1; i < pts.length; i++)
				if (
					Math.hypot(
						pts[i][0] - pts[i - 1][0],
						pts[i][1] - pts[i - 1][1],
						pts[i][2] - pts[i - 1][2]
					) > 0.01
				)
					out.push(
						k.pipe([pts[i - 1], pts[i]], p.radius, '--signal', { rank: 0, material: 'metal' })
					);
			for (const q of pts.slice(1, -1))
				out.push(k.sphere(q[0], q[1], q[2], p.radius, '--signal', { rank: 0 }));
			// Supports: a post under every elbow that hangs in the air.
			if (p.stuetzen)
				for (const q of pts.slice(1, -1))
					if (q[2] - k.ctx.z > p.radius * 3)
						out.push(
							k.box(
								q[0] - 0.15,
								q[1] - 0.15,
								k.ctx.z,
								0.3,
								0.3,
								q[2] - k.ctx.z - p.radius,
								'--paper',
								{ rank: 0, material: 'metal' }
							)
						);
			return out;
		}
	})
];
