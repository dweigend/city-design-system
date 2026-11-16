import type { Primitive } from '../types';
import { family, spec } from './kit';

/** Ring: upright ring, torus stack, spiral (06, 136, r3-03, R20-03). */
export const ring = [
	family({
		id: 'ring-stehend',
		name: 'Upright ring with beam',
		group: 'ring',
		refs: ['19', 'r3-03', '06'],
		params: [
			spec('radius', 'Radius share', 0.4, 1, 0.05, 0.85),
			spec('tiefe', 'Depth m', 0.6, 4, 0.1, 1.8),
			spec('balken', 'Beam', 0, 1, 1, 1)
		],
		build(k, p) {
			// Ring plane spans local v and z; its axis runs along u.
			const R = Math.min(k.hv * p.radius, (k.ctx.height - 0.6) / 2),
				z = k.ctx.z + R + 0.6,
				out: Primitive[] = [
					k.box(-0.4, -R * 0.55, k.ctx.z, 0.8, 0.8, z - R - k.ctx.z + 0.4, '--paper', {
						rank: 0,
						material: 'metal'
					}),
					k.box(-0.4, R * 0.55 - 0.8, k.ctx.z, 0.8, 0.8, z - R - k.ctx.z + 0.4, '--paper', {
						rank: 0,
						material: 'metal'
					}),
					k.ring(0, 0, z, R, R * 0.68, p.tiefe, k.tone(0), { rank: 1 })
				];
			if (p.balken) {
				const s = R * 0.5;
				out.push(k.box(-k.hu, -s / 2, z - s / 2 - R * 0.1, k.hu * 2, s, s, k.tone(1), { rank: 2 }));
			}
			return out;
		}
	}),
	family({
		id: 'ring-torusturm',
		name: 'Torus tower',
		group: 'ring',
		refs: ['136', '22', 'R04-06'],
		params: [
			spec('ringe', 'Rings', 2, 9, 1, 5),
			spec('schwund', 'Shrink', 0.5, 1, 0.02, 0.85),
			spec('kern', 'Core share', 0.2, 0.7, 0.05, 0.4)
		],
		build(k, p) {
			const R0 = k.radius * 0.9,
				out: Primitive[] = [];
			let z = k.ctx.z,
				R = R0;
			const core = R0 * p.kern;
			for (let i = 0; i < p.ringe; i++) {
				const tube = Math.max(0.3, (R - core) / 2);
				if (z + tube * 2 > k.top) break;
				out.push(k.torus(k.ou, k.ov, z + tube, R - tube, tube, k.tone(i % 3), { rank: i }));
				z += tube * 2;
				R = Math.max(core + 0.6, R * p.schwund);
			}
			out.push(
				k.cylinder(
					k.ou,
					k.ov,
					k.ctx.z,
					core,
					Math.min(k.ctx.height, z - k.ctx.z + core * 1.2),
					'--paper',
					{ rank: 0 }
				)
			);
			return out;
		}
	}),
	family({
		id: 'ring-spirale',
		name: 'Spiral around core',
		group: 'ring',
		refs: ['R20-03', '136', '30'],
		params: [
			spec('windungen', 'Turns', 0.5, 4, 0.25, 1.75),
			spec('breite', 'Width share', 0.2, 0.7, 0.05, 0.45),
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.85)
		],
		build(k, p) {
			const R = k.radius * 0.95,
				inner = R * (1 - p.breite),
				H = k.ctx.height * p.hoehe;
			return [
				k.cylinder(k.ou, k.ov, k.ctx.z, inner * 0.7, H + 1, k.tone(1), { rank: 0 }),
				k.helix(k.ou, k.ov, k.ctx.z, R, inner, H, p.windungen, 0.6, k.tone(0), { rank: 1 })
			];
		}
	})
];
