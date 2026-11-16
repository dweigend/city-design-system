import type { Primitive } from '../types';
import { family, spec } from './kit';
import { contains, inradius } from './geom';

/**
 * Crown: termination of a stack (18, 19, 20, 22, 31, 34).
 * In the catalog every crown stands on a thin slab so that it stays legible.
 */
export const kopf = [
	family({
		id: 'kopf-hut',
		name: 'Cone and hat',
		group: 'kopf',
		refs: ['18', '22', 'r3-03'],
		params: [
			spec('typ', 'Type (cone, hat, spire)', 0, 2, 1, 1),
			spec('hoehe', 'Height', 0.2, 1, 0.05, 0.6),
			spec('trommel', 'Drum', 0, 1, 0.05, 0.4)
		],
		build(k, p) {
			const R = k.radius * 0.85,
				H = k.ctx.height * p.hoehe,
				drum = H * p.trommel * 0.5,
				out: Primitive[] = [];
			if (drum > 0.2)
				out.push(k.cylinder(k.ou, k.ov, k.ctx.z, R * 0.8, drum, k.tone(1), { rank: 0 }));
			const z = k.ctx.z + drum;
			if (p.typ === 1) {
				// Hat: brim disc and a narrower cone (22, Memphis).
				out.push(k.cylinder(k.ou, k.ov, z, R, 0.4, k.tone(0), { rank: 1 }));
				out.push(k.cone(k.ou, k.ov, z + 0.4, R * 0.55, H - drum - 0.4, k.tone(0), { rank: 1 }));
			} else if (p.typ === 2) {
				out.push(k.cone(k.ou, k.ov, z, R * 0.35, H - drum, k.tone(0), { rank: 1 }));
				out.push(k.sphere(k.ou, k.ov, z + H - drum, R * 0.12, k.tone(2), { rank: 2 }));
			} else out.push(k.cone(k.ou, k.ov, z, R * 0.8, H - drum, k.tone(0), { rank: 1 }));
			return out;
		}
	}),
	family({
		id: 'kopf-kuppel',
		name: 'Dome',
		group: 'kopf',
		refs: ['31', '20', '03'],
		params: [
			spec('facetten', 'Facets (smooth, 1, 2)', 0, 2, 1, 1),
			spec('stich', 'Rise', 0.3, 1.2, 0.05, 0.9),
			spec('glas', 'Glass', 0, 1, 1, 0)
		],
		build(k, p) {
			const R = k.radius * 0.92;
			return [
				k.cylinder(k.ou, k.ov, k.ctx.z, R * 1.04, 0.5, '--paper', { rank: 0 }),
				k.dome(k.ou, k.ov, k.ctx.z + 0.5, R, R * p.stich, p.facetten, k.tone(0), {
					rank: 1,
					glass: !!p.glas
				})
			];
		}
	}),
	family({
		id: 'kopf-solarfeld',
		name: 'Solar field',
		group: 'kopf',
		refs: ['34', '31', '25'],
		params: [
			spec('reihen', 'Rows', 2, 8, 1, 4),
			spec('neigung', 'Tilt', 0.3, 1.5, 0.05, 0.8),
			spec('ueberdeckung', 'Coverage', 0.3, 1, 0.05, 0.7)
		],
		build(k, p) {
			const out: Primitive[] = [k.prism(k.outline(0.2), k.ctx.z, 0.4, '--paper', { rank: 0 })],
				row = (k.hu * 2) / p.reihen,
				d = row * p.ueberdeckung,
				h = Math.min(d * p.neigung, k.ctx.height - 0.5);
			// Rows across the fitted rectangle; each panel rises along u (sawtooth to the sun).
			for (let i = 0; i < p.reihen; i++)
				out.push(
					k.wedge(
						-k.hu + i * row + (row - d) / 2,
						-k.hv + Math.min(0.3, k.hv * 0.3),
						k.ctx.z + 0.4,
						d,
						k.hv * 2 - 2 * Math.min(0.3, k.hv * 0.3),
						h,
						0,
						k.tone(0),
						{
							rank: 1,
							material: 'metal'
						}
					)
				);
			return out;
		}
	}),
	family({
		id: 'kopf-noppen',
		name: 'Stud plate',
		group: 'kopf',
		refs: ['19', '09', 'R01-12'],
		params: [
			spec('raster', 'Grid m', 1.2, 4, 0.1, 2.2),
			spec('noppe', 'Stud', 0.2, 0.45, 0.01, 0.32),
			spec('platte', 'Plate m', 0.3, 2, 0.1, 0.8)
		],
		build(k, p) {
			const poly = k.outline(0.2),
				out: Primitive[] = [k.prism(poly, k.ctx.z, p.platte, k.tone(0), { rank: 0 })];
			const r = p.raster * p.noppe;
			for (let u = -k.hu * 2; u <= k.hu * 2; u += p.raster)
				for (let v = -k.hv * 2; v <= k.hv * 2; v += p.raster) {
					const [x, y] = k.world(u, v);
					if (!contains(poly, [x, y]) || inradius(poly, [x, y]) < r * 1.1) continue;
					out.push(k.cylinder(u, v, k.ctx.z + p.platte, r, r * 0.9, k.tone(0), { rank: 1 }));
				}
			return out;
		}
	})
];
