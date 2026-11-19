import { capsuleSkin, surfaceBand } from '../../profile-fit';
import { required } from '../../required';
import type { Primitive } from '../types';
import { family, spec } from './kit';
import { bullaugen, type Kugel } from './bullauge';

/** Capsule: tube capsule, sphere house, cushion, UFO (03, 21, 116, R20-08). */
export const kapsel = [
	family({
		id: 'kapsel-roehre',
		name: 'Tube capsule on stilts',
		group: 'kapsel',
		refs: ['21', '116', '03'],
		params: [
			spec('laenge', 'Length', 0.4, 1, 0.05, 0.9),
			spec('lage', 'Elevation', 0, 0.7, 0.05, 0.3),
			spec('bullaugen', 'Portholes', 0, 6, 1, 3)
		],
		build(k, p) {
			const r = Math.min(k.hv * 0.45, k.ctx.height * 0.15),
				half = Math.max(0, k.hu * p.laenge - r),
				z = k.ctx.z + r + k.ctx.height * p.lage * 0.6,
				out: Primitive[] = [];
			const lift = z - r - k.ctx.z;
			if (lift > 0.4)
				for (const u of [-half * 0.6, half * 0.6])
					out.push(
						k.cylinder(u, 0, k.ctx.z, 0.25, lift + r * 0.3, '--paper', {
							rank: 0,
							material: 'metal'
						})
					);
			out.push(k.capsule([-half, 0, z], [half, 0, z], r, k.tone(0), { rank: 1 }));
			// Space the trim on the available frontage. The front returns follow the
			// cylindrical wall and continue onto the spherical ends of short capsules.
			const frontage = Math.max(half * 0.8, r * 0.45);
			const outer = Math.min(r * 0.32, (frontage * 0.9) / Math.max(1, p.bullaugen - 1));
			for (let i = 0; i < p.bullaugen; i++) {
				const station = p.bullaugen === 1 ? 0 : -frontage + (2 * frontage * i) / (p.bullaugen - 1);
				const band = surfaceBand(outer * 0.625, outer, -0.015, 0.105, (u, h, offset) => {
					const depth = required(
						capsuleSkin(r, half, station + u, h),
						'porthole within capsule skin'
					);
					return k.at(station + u, -depth - offset, z + h);
				});
				out.push({ ...k.base('--paper', { rank: 1 }), ...band });
			}
			return out;
		}
	}),
	family({
		id: 'kapsel-kugelhaus',
		name: 'Sphere house',
		group: 'kapsel',
		refs: ['21', '03', 'R01-12'],
		params: [
			spec('radius', 'Radius share', 0.4, 1, 0.05, 0.85),
			spec('stiel', 'Stem', 0, 1, 0.05, 0.45),
			spec('kugeln', 'Spheres', 1, 3, 1, 1),
			spec('fenster', 'Windows per sphere', 0, 12, 1, 6)
		],
		build(k, p) {
			const out: Primitive[] = [];
			const n = p.kugeln,
				R = Math.min(k.radius * p.radius, k.ctx.height * 0.4) / (n === 1 ? 1 : 1.6);
			const kugeln: Kugel[] = [];
			let z = k.ctx.z;
			const stem = (k.ctx.height - R * 2 * n) * p.stiel;
			if (stem > 0.3) {
				out.push(
					k.cylinder(k.ou, k.ov, z, R * 0.18, stem + R * 0.2, '--paper', {
						rank: 0,
						material: 'metal'
					})
				);
				z += stem;
			}
			for (let i = 0; i < n; i++) {
				const u = k.ou + (n > 1 ? (i - (n - 1) / 2) * R * 0.35 : 0);
				out.push(k.sphere(u, k.ov, z + R, R, k.tone(i), { rank: i + 1 }));
				// Belly band: a flat torus as band window.
				out.push(k.torus(u, k.ov, z + R, R * 1.0, R * 0.06, '--paper', { rank: i + 1 }));
				kugeln.push({ center: [u, k.ov, z + R], radius: R });
				z += R * 1.75;
			}
			// Portholes (bullauge.ts): frame and pane follow the curvature of the sphere.
			// Frame 8 cm in front of the skin, pane 3 cm: it sits visibly recessed.
			// Sunny side: the world's south (−y) in the cell's local frame.
			for (const b of bullaugen(kugeln, p.fenster, k.ctx.seed, -Math.PI / 2 - k.rot)) {
				const lage = {
					rank: b.kugel + 1,
					turn: b.azimut,
					tilt: b.breite,
					curvature: kugeln[b.kugel].radius
				};
				const pane = b.radius * 0.74;
				out.push(
					k.ring(...b.position, b.radius, pane, 0.16, '--paper', { ...lage, material: 'metal' }),
					k.ring(...b.position, pane, 0, 0.06, '--paper', { ...lage, shade: 0.5 })
				);
			}
			return out;
		}
	}),
	family({
		id: 'kapsel-kissen',
		name: 'Cushion stack',
		group: 'kapsel',
		refs: ['R20-08', '29'],
		params: [
			spec('lagen', 'Layers', 1, 6, 1, 3),
			spec('dicke', 'Thickness m', 1, 4, 0.1, 2.2),
			spec('kreuz', 'Crossed', 0, 1, 1, 1)
		],
		build(k, p) {
			// Capsules side by side form a soft slab; layers alternate direction (log cabin).
			const out: Primitive[] = [],
				r = p.dicke / 2;
			let z = k.ctx.z + r;
			for (let l = 0; l < p.lagen && z + r <= k.top + 0.01; l++) {
				const along = !p.kreuz || l % 2 === 0;
				const [lu, lv] = along ? [k.hu, k.hv] : [k.hv, k.hu];
				const count = Math.max(1, Math.floor((lv * 2) / (r * 2.05)));
				const token = k.tone(l % 2);
				for (let i = 0; i < count; i++) {
					const off =
						-lv + r + ((i * (lv * 2 - r * 2)) / Math.max(1, count - 1)) * (count > 1 ? 1 : 0);
					const a: [number, number] = along ? [-lu + r, off] : [off, -lu + r];
					const b: [number, number] = along ? [lu - r, off] : [off, lu - r];
					out.push(k.capsule([a[0], a[1], z], [b[0], b[1], z], r, token, { rank: l }));
				}
				z += r * 1.9;
			}
			return out;
		}
	}),
	family({
		id: 'kapsel-ufo',
		name: 'UFO',
		group: 'kapsel',
		refs: ['21', '30', '116'],
		params: [
			spec('radius', 'Radius share', 0.4, 1, 0.05, 0.95),
			spec('hoehe', 'Elevation', 0.2, 1, 0.05, 0.6),
			spec('linse', 'Lens', 0.15, 0.6, 0.05, 0.3)
		],
		build(k, p) {
			const R = k.radius * p.radius,
				lens = R * p.linse,
				z = k.ctx.z + Math.max(lens, (k.ctx.height - lens * 2) * p.hoehe);
			return [
				k.cylinder(k.ou, k.ov, k.ctx.z, R * 0.16, z - k.ctx.z, k.tone(1), { rank: 0 }),
				k.sphere(k.ou, k.ov, z, R, k.tone(0), { rank: 1, squash: p.linse }),
				k.dome(k.ou, k.ov, z + lens * 0.7, R * 0.38, R * 0.3, 0, '--paper', {
					rank: 2,
					glass: true
				})
			];
		}
	})
];
