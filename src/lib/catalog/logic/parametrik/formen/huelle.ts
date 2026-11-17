import type { Primitive, Vec3 } from '../types';
import { family, spec } from './kit';

/** Envelope: climate skin, greenhouse, membrane (16, 27, 48). */
export const huelle = [
	family({
		id: 'huelle-klimahaut',
		name: 'Climate skin over contents',
		group: 'huelle',
		refs: ['16', '48'],
		params: [
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.85),
			spec('inhalt', 'Contents', 0, 6, 1, 3),
			spec('abstand', 'Spacing m', 0, 2, 0.1, 0.4)
		],
		build(k, p) {
			const H = k.ctx.height * p.hoehe,
				out: Primitive[] = [
					k.prism(k.outline(p.abstand), k.ctx.z, H, k.tone(0), { rank: 1, glass: true })
				];
			// Contents: small colored blocks stacked loosely inside the skin.
			let z = k.ctx.z;
			for (let i = 0; i < p.inhalt; i++) {
				const w = k.hu * (0.5 + k.rng() * 0.6),
					d = k.hv * (0.5 + k.rng() * 0.6),
					h = Math.min(H / Math.max(2, p.inhalt * 0.7), H - (z - k.ctx.z) - 0.6);
				if (h < 0.8) break;
				const u = -k.hu + p.abstand + 0.4 + k.rng() * (k.hu * 2 - w - 2 * p.abstand - 0.8),
					v = -k.hv + p.abstand + 0.4 + k.rng() * (k.hv * 2 - d - 2 * p.abstand - 0.8);
				out.push(k.box(u, v, z, w, d, h, k.tone(i), { rank: 0 }));
				if (k.rng() < 0.6) z += h;
			}
			return out;
		}
	}),
	family({
		id: 'huelle-gewaechshaus',
		name: 'Greenhouse',
		group: 'huelle',
		refs: ['27', '48', '16'],
		params: [
			spec('rippen', 'Ribs', 2, 10, 1, 5),
			spec('stich', 'Rise', 0.3, 1.2, 0.05, 0.9),
			spec('sockel', 'Plinth m', 0, 3, 0.1, 1)
		],
		build(k, p) {
			const w = k.hv * 2,
				l = k.hu * 2,
				sockel = Math.min(p.sockel, k.ctx.height * 0.4),
				rise = Math.min((w / 2) * p.stich, k.ctx.height - sockel),
				z = k.ctx.z + sockel,
				out: Primitive[] = [];
			if (sockel > 0.1)
				out.push(k.box(-k.hu, -k.hv, k.ctx.z, l, w, sockel, k.tone(1), { rank: 0 }));
			out.push(
				k.arch('vault', 0, 0, z, w, l, rise, '--cat-nature', {
					rank: 1,
					glass: true,
					turn: Math.PI / 2
				})
			);
			for (let i = 0; i < p.rippen; i++) {
				const u = -k.hu + 0.15 + (i * (l - 0.3)) / (p.rippen - 1);
				out.push(
					k.arch('vault', u, 0, z, w + 0.1, 0.3, rise + 0.05, '--paper', {
						rank: 1,
						thickness: Math.min(0.3, w * 0.2, rise * 0.4),
						material: 'metal',
						turn: Math.PI / 2
					})
				);
			}
			// Beds inside: green strips.
			const margin = Math.min(0.8, l * 0.15),
				bedWidth = Math.min(1.2, w * 0.3);
			for (const v of [-w / 4, w / 4])
				out.push(
					k.box(
						-k.hu + margin,
						v - bedWidth / 2,
						z,
						l - 2 * margin,
						bedWidth,
						Math.min(0.6, rise * 0.4),
						'--cat-nature',
						{ rank: 0 }
					)
				);
			return out;
		}
	}),
	family({
		id: 'huelle-membran',
		name: 'Membrane on masts',
		group: 'huelle',
		refs: ['16', '32'],
		params: [
			spec('hoch', 'High point', 0.4, 1, 0.05, 0.95),
			spec('tief', 'Low point', 0.1, 0.8, 0.05, 0.35),
			spec('durchhang', 'Sag m', 0, 2, 0.1, 0.6)
		],
		build(k, p) {
			const hi = k.ctx.z + k.ctx.height * p.hoch,
				lo = k.ctx.z + k.ctx.height * p.tief,
				c: Vec3[] = [
					[-k.hu, -k.hv, hi],
					[k.hu, -k.hv, lo],
					[k.hu, k.hv, hi],
					[-k.hu, k.hv, lo]
				];
			const out: Primitive[] = c.map(([u, v, z]) =>
				k.cylinder(u, v, k.ctx.z, 0.18, z - k.ctx.z + 0.8, '--paper', {
					rank: 0,
					material: 'metal'
				})
			);
			out.push(k.membrane(c as [Vec3, Vec3, Vec3, Vec3], p.durchhang, k.tone(0), { rank: 1 }));
			// Guy ropes: a line from each high mast to the ground outside.
			for (const [u, v, z] of [c[0], c[2]])
				out.push(
					k.polyline(
						[
							[u, v, z + 0.8],
							[u * 1.15, v * 1.15, k.ctx.z]
						],
						false,
						'--paper',
						{ rank: 0 }
					)
				);
			return out;
		}
	})
];
