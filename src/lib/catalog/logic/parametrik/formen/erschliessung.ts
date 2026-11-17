import type { Primitive } from '../types';
import type { Kit } from './kit';
import { family, spec } from './kit';

/** Straight flight as stepped boxes from (u, v, z) along +u; returns end u. */
function flight(
	k: Kit,
	u: number,
	v: number,
	z: number,
	run: number,
	rise: number,
	width: number,
	steps: number,
	dir: 1 | -1,
	rank: number,
	out: Primitive[]
) {
	const tread = run / steps,
		step = rise / steps;
	for (let i = 0; i < steps; i++) {
		const su = dir === 1 ? u + i * tread : u - (i + 1) * tread;
		out.push(
			// Dense tread outlines merge into black bands at the laboratory scale.
			k.box(su, v, z + i * step, tread, width, step, '--paper', {
				rank,
				material: 'metal',
				edges: false
			})
		);
	}
}

/** Circulation: external stair, spiral, stair tower, footbridge (07, 36, 38, 43, 98). */
export const erschliessung = [
	family({
		id: 'erschliessung-aussentreppe',
		name: 'Straight external stair',
		group: 'erschliessung',
		refs: ['07', '22'],
		params: [
			spec('laeufe', 'Flights', 1, 3, 1, 2),
			spec('breite', 'Width m', 0.8, 3, 0.1, 1.4),
			spec('podest', 'Landing share', 0.1, 0.4, 0.02, 0.2)
		],
		build(k, p) {
			const out: Primitive[] = [],
				rise = Math.min(k.ctx.height * 0.85, 3.2 * p.laeufe) / p.laeufe,
				land = k.hu * 2 * p.podest,
				run = k.hu * 2 - land;
			let z = k.ctx.z;
			for (let i = 0; i < p.laeufe; i++) {
				const dir = i % 2 === 0 ? 1 : -1,
					v = -k.hv + Math.min(i * p.breite * 1.05, k.hv * 2 - p.breite);
				const u0 = dir === 1 ? -k.hu : k.hu - land;
				flight(k, u0, v, z, run, rise, p.breite, Math.max(4, Math.round(rise / 0.35)), dir, i, out);
				z += rise;
				// Landing: colored landing slab on legs.
				const pu = dir === 1 ? k.hu - land : -k.hu;
				out.push(
					k.box(
						pu,
						-k.hv,
						z - 0.3,
						land,
						Math.min(k.hv * 2, p.breite * (p.laeufe > 1 ? 2.1 : 1)),
						0.3,
						k.tone(0),
						{ rank: i }
					)
				);
				out.push(
					k.box(
						pu + land / 2 - 0.15,
						-k.hv + 0.1,
						k.ctx.z,
						0.3,
						0.3,
						z - k.ctx.z - 0.3,
						'--paper',
						{ rank: 0, material: 'metal' }
					)
				);
			}
			return out;
		}
	}),
	family({
		id: 'erschliessung-wendel',
		name: 'Spiral stair',
		group: 'erschliessung',
		refs: ['36', '98', '07'],
		params: [
			spec('windungen', 'Turns', 0.5, 3, 0.25, 1.5),
			spec('stufen', 'Steps per turn', 8, 24, 1, 14),
			spec('spindel', 'Spindle share', 0.05, 0.4, 0.01, 0.14)
		],
		build(k, p) {
			const R = Math.min(k.radius * 0.9, 4),
				n = Math.round(p.windungen * p.stufen),
				h = (k.ctx.height * 0.9) / n,
				core = R * p.spindel,
				out: Primitive[] = [
					k.cylinder(k.ou, k.ov, k.ctx.z, core, k.ctx.height * 0.9 + 1, k.tone(0), { rank: 0 })
				];
			// Steps: radial boards rotated about the spindle.
			const [cx, cy] = k.world(k.ou, k.ov);
			for (let i = 0; i < n; i++) {
				const a = k.rot + (i / p.stufen) * Math.PI * 2,
					mid = (core + R) / 2,
					w = R - core,
					d = Math.min(1.1, ((Math.PI * 2 * mid) / p.stufen) * 1.1);
				const x = cx + Math.cos(a) * mid,
					y = cy + Math.sin(a) * mid;
				out.push({
					...k.box(0, 0, k.ctx.z + i * h, w, d, 0.2, '--paper', {
						rank: 0,
						material: 'metal',
						edges: false
					}),
					kind: 'box',
					position: [x - w / 2, y - d / 2, k.ctx.z + i * h],
					size: [w, d, 0.2],
					rotation: a
				});
			}
			out.push(
				k.helix(
					k.ou,
					k.ov,
					k.ctx.z + 1,
					R + 0.05,
					R - 0.05,
					k.ctx.height * 0.9,
					p.windungen,
					0.08,
					k.tone(1),
					{ rank: 0 }
				)
			);
			return out;
		}
	}),
	family({
		id: 'erschliessung-treppenturm',
		name: 'Stair tower',
		group: 'erschliessung',
		refs: ['A', '43', '36', '26'],
		params: [
			spec('geschosse', 'Floors', 2, 6, 1, 4),
			spec('breite', 'Width m', 2, 5, 0.1, 3),
			spec('verkleidung', 'Cladding', 0, 1, 1, 0)
		],
		build(k, p) {
			const W = Math.min(p.breite * 2, k.hu * 2),
				D = Math.min(p.breite, k.hv * 2),
				fh = k.ctx.height / p.geschosse,
				out: Primitive[] = [
					k.frame(
						-W / 2,
						-D / 2,
						k.ctx.z,
						W,
						D,
						k.ctx.height,
						[2, 1, p.geschosse],
						0.16,
						'--paper',
						{ rank: 1 }
					)
				];
			// Scissor flights: half-story runs alternating in each bay.
			for (let f = 0; f < p.geschosse * 2; f++) {
				const dir = f % 2 === 0 ? 1 : -1,
					v = f % 2 === 0 ? -D / 2 + 0.1 : 0.05,
					u0 = dir === 1 ? -W / 2 + 0.6 : W / 2 - 0.6;
				flight(k, u0, v, k.ctx.z + (f * fh) / 2, W - 1.2, fh / 2, D / 2 - 0.15, 7, dir, 0, out);
			}
			if (p.verkleidung)
				out.push(
					k.box(-W / 2 - 0.05, D / 2 - 0.1, k.ctx.z, W + 0.1, 0.2, k.ctx.height, k.tone(0), {
						rank: 1
					})
				);
			return out;
		}
	}),
	family({
		id: 'erschliessung-steg',
		name: 'Footbridge with ramp',
		group: 'erschliessung',
		refs: ['38', '33', '44'],
		params: [
			spec('hoehe', 'Elevation', 0.2, 0.8, 0.05, 0.45),
			spec('breite', 'Width m', 1.2, 4, 0.1, 2.4),
			spec('rampe', 'Ramp', 0, 1, 1, 1)
		],
		build(k, p) {
			const z = k.ctx.z + k.ctx.height * p.hoehe,
				b = Math.min(p.breite, k.hv),
				out: Primitive[] = [
					k.box(-k.hu, -k.hv, z - 0.5, k.hu * 2, b, 0.5, k.tone(0), { rank: 1 }),
					// Parapet: thin rails as boxes.
					k.box(-k.hu, -k.hv, z, k.hu * 2, 0.08, 1.0, k.tone(0), { rank: 1 }),
					k.box(-k.hu, -k.hv + b - 0.08, z, k.hu * 2, 0.08, 1.0, k.tone(0), { rank: 1 })
				];
			for (const u of [-k.hu * 0.6, k.hu * 0.6])
				out.push(
					k.box(u - 0.35, -k.hv + b / 2 - 0.35, k.ctx.z, 0.7, 0.7, z - k.ctx.z - 0.5, k.tone(1), {
						rank: 0
					})
				);
			if (p.rampe) {
				const v = -k.hv + b + 0.3,
					d = Math.min(b, k.hv * 2 - b - 0.3);
				if (d > 0.6)
					out.push(
						k.wedge(-k.hu, v, k.ctx.z, k.hu * 2, d, z - k.ctx.z, 0, k.tone(0), {
							rank: 0,
							turn: Math.PI
						})
					);
			}
			return out;
		}
	})
];
