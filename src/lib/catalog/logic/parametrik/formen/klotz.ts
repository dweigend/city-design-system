import type { Primitive } from '../types';
import { family, spec } from './kit';

/** Block mass: primary volume of box, wedge and step (09, 12, 15, 18, R01, R04). */
export const klotz = [
	family({
		id: 'klotz-prisma',
		name: 'Prism',
		group: 'klotz',
		refs: ['12', 'R16-01', 'R01'],
		params: [
			spec('hoehe', 'Height', 0.2, 1, 0.05, 0.55),
			spec('einzug', 'Inset m', 0, 3, 0.1, 0.6),
			spec('fuge', 'Joint', 0, 1, 1, 1)
		],
		build(k, p) {
			const { z } = k.ctx,
				h = k.ctx.height * p.hoehe,
				poly = k.outline(p.einzug);
			if (!p.fuge) return [k.prism(poly, z, h, k.tone(0), { rank: 0 })];
			// Joint: a dark recessed joint splits plinth and body.
			const cut = Math.min(h * 0.3, 3.2);
			return [
				k.prism(poly, z, cut, k.tone(0), { rank: 0 }),
				k.prism(k.outline(p.einzug + 0.5), z + cut, 0.6, k.tone(0), { rank: 1, shade: 0.35 }),
				k.prism(poly, z + cut + 0.6, h - cut - 0.6, k.tone(1), { rank: 2 })
			];
		}
	}),
	family({
		id: 'klotz-wuerfelstapel',
		name: 'Cube stack',
		group: 'klotz',
		refs: ['09', '18', 'R01'],
		params: [
			spec('stufen', 'Cubes', 2, 6, 1, 4),
			spec('versatz', 'Offset', 0, 1, 0.05, 0.6),
			spec('schwund', 'Shrink', 0.5, 1, 0.05, 0.78)
		],
		build(k, p) {
			const out: Primitive[] = [];
			// Geometric series: s0 · (1 + q + q² …) must fit the height budget.
			let series = 0;
			for (let i = 0; i < p.stufen; i++) series += p.schwund ** i;
			let s = Math.min(k.hu, k.hv) * 2,
				z = k.ctx.z,
				u = -s / 2,
				v = -s / 2;
			// Fit the stack vertically without shrinking its footprint to a thin tower.
			const heightScale = Math.min(1, k.ctx.height / (s * series));
			for (let i = 0; i < p.stufen; i++) {
				const h = Math.min(s * heightScale, k.top - z);
				out.push(k.box(u, v, z, s, s, h, k.tone(i), { rank: i }));
				z += h;
				const next = s * p.schwund;
				// Next cube shifts inside the one below: edge flush on a seeded side.
				const room = s - next;
				u += room * (k.rng() < 0.5 ? 0 : 1) * p.versatz + (room * (1 - p.versatz)) / 2;
				v += room * (k.rng() < 0.5 ? 0 : 1) * p.versatz + (room * (1 - p.versatz)) / 2;
				s = next;
			}
			return out;
		}
	}),
	family({
		id: 'klotz-keil',
		name: 'Wedge',
		group: 'klotz',
		refs: ['09', '12', '20'],
		params: [
			spec('hoehe', 'Height', 0.2, 1, 0.05, 0.7),
			spec('fall', 'Slope', 0, 0.8, 0.05, 0.15),
			spec('sockel', 'Plinth', 0, 0.6, 0.05, 0.3)
		],
		build(k, p) {
			const H = k.ctx.height * p.hoehe,
				base = H * p.sockel,
				w = k.hu * 2,
				d = k.hv * 2;
			const out: Primitive[] = [];
			if (base > 0.3) out.push(k.box(-k.hu, -k.hv, k.ctx.z, w, d, base, k.tone(1), { rank: 0 }));
			out.push(
				k.wedge(-k.hu, -k.hv, k.ctx.z + base, w, d, H - base, p.fall, k.tone(0), { rank: 1 })
			);
			return out;
		}
	}),
	family({
		id: 'klotz-zikkurat',
		name: 'Step',
		group: 'klotz',
		refs: ['15', 'R04', '07'],
		params: [
			spec('stufen', 'Steps', 2, 7, 1, 4),
			spec('ruecksprung', 'Setback m', 0.4, 2.5, 0.1, 1.2),
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.75)
		],
		build(k, p) {
			const step = (k.ctx.height * p.hoehe) / p.stufen;
			const out: Primitive[] = [];
			for (let i = 0; i < p.stufen; i++)
				out.push(
					k.prism(
						k.outline(0.3 + i * p.ruecksprung),
						k.ctx.z + i * step,
						step,
						k.tone(i % 2 ? 1 : 0),
						{
							rank: i
						}
					)
				);
			return out;
		}
	}),
	family({
		id: 'klotz-verschraenkt',
		name: 'Offset rectangles',
		group: 'klotz',
		refs: ['12', '13', '06'],
		params: [
			spec('teile', 'Parts', 2, 4, 1, 3),
			spec('ueberstand', 'Overhang', 0, 0.4, 0.02, 0.18),
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.6)
		],
		build(k, p) {
			const out: Primitive[] = [];
			const H = (k.ctx.height * p.hoehe) / p.teile;
			for (let i = 0; i < p.teile; i++) {
				// Alternating long axis; each bar sticks out over the one below (cantilever).
				const along = i % 2 === 0,
					long = (along ? k.hu : k.hv) * 2 * (1 + p.ueberstand),
					short = (along ? k.hv : k.hu) * (0.7 + k.rng() * 0.3);
				const shift = (k.rng() - 0.5) * (along ? k.hv : k.hu) * 0.8;
				const [w, d] = along ? [long, short] : [short, long];
				const u = along ? -long / 2 + (k.rng() - 0.5) * p.ueberstand * k.hu : -short / 2 + shift;
				const v = along ? -short / 2 + shift : -long / 2 + (k.rng() - 0.5) * p.ueberstand * k.hv;
				out.push(k.box(u, v, k.ctx.z + i * H, w, d, H, k.tone(i), { rank: i }));
			}
			return out;
		}
	})
];
