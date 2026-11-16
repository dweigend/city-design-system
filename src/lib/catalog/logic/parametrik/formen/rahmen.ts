import type { Primitive } from '../types';
import { family, spec } from './kit';
import { grundrissRahmen, rechteckigerRahmen } from './grundrissRahmen';

/** Frame: lattice cube, plug-in frame, truss girder (06, 15, 26, 36, U01). */
export const rahmen = [
	family({
		id: 'rahmen-gitterwuerfel',
		name: 'Lattice cube with plug-in module',
		group: 'rahmen',
		refs: ['15', '18', '09'],
		params: [
			spec('felder', 'Bays', 1, 4, 1, 2),
			spec('belegung', 'Occupancy', 0, 1, 0.05, 0.35),
			spec('stab', 'Strut m', 0.1, 0.5, 0.02, 0.24)
		],
		build(k, p) {
			if (!rechteckigerRahmen(k)) return grundrissRahmen(k, p, false);
			const s = Math.min(k.hu, k.hv) * 2,
				h = Math.min(s, k.ctx.height),
				n = p.felder,
				c = s / n,
				ch = h / n,
				out: Primitive[] = [
					k.frame(-s / 2, -s / 2, k.ctx.z, s, s, h, [n, n, n], p.stab, '--paper', { rank: 1 })
				];
			// Plug-in module: whole cells filled, seeded, lower cells first (gravity).
			let i = 0;
			for (let z = 0; z < n; z++)
				for (let x = 0; x < n; x++)
					for (let y = 0; y < n; y++)
						if (k.rng() < p.belegung * (1 - z * 0.15))
							out.push(
								k.box(
									-s / 2 + x * c + 0.15,
									-s / 2 + y * c + 0.15,
									k.ctx.z + z * ch + 0.1,
									c - 0.3,
									c - 0.3,
									ch - 0.2,
									k.tone(i++),
									{
										rank: 0
									}
								)
							);
			return out;
		}
	}),
	family({
		id: 'rahmen-plugin',
		name: 'Plug-in frame',
		group: 'rahmen',
		refs: ['26', '36', '06', '43'],
		params: [
			spec('geschosse', 'Floors', 2, 6, 1, 4),
			spec('belegung', 'Occupancy', 0, 1, 0.05, 0.55),
			spec('ausschub', 'Pull-out', 0, 1, 0.05, 0.5)
		],
		build(k, p) {
			if (!rechteckigerRahmen(k)) return grundrissRahmen(k, p, true);
			const fh = k.ctx.height / p.geschosse,
				nu = Math.max(1, Math.round((k.hu * 2) / 4)),
				nv = Math.max(1, Math.round((k.hv * 2) / 4)),
				cu = (k.hu * 2) / nu,
				cv = (k.hv * 2) / nv,
				out: Primitive[] = [
					k.frame(
						-k.hu,
						-k.hv,
						k.ctx.z,
						k.hu * 2,
						k.hv * 2,
						k.ctx.height,
						[nu, nv, p.geschosse],
						0.22,
						'--paper',
						{
							rank: 1,
							braced: true
						}
					)
				];
			let n = 0;
			for (let f = 0; f < p.geschosse; f++)
				for (let i = 0; i < nu; i++)
					for (let j = 0; j < nv; j++) {
						if (k.rng() > p.belegung) continue;
						// Edge cells slide outward (pull-out) like drawers.
						const du = i === 0 ? -1 : i === nu - 1 ? 1 : 0,
							dv = j === 0 ? -1 : j === nv - 1 ? 1 : 0,
							slide = p.ausschub * (k.rng() < 0.5 ? cu : cv) * 0.45;
						const [su, sv] = k.rng() < 0.5 ? [du * slide, 0] : [0, dv * slide];
						out.push(
							k.box(
								-k.hu + i * cu + 0.25 + su,
								-k.hv + j * cv + 0.25 + sv,
								k.ctx.z + f * fh + 0.15,
								cu - 0.5,
								cv - 0.5,
								fh - 0.3,
								k.tone(n++ % 3),
								{
									rank: 0
								}
							)
						);
					}
			return out;
		}
	}),
	family({
		id: 'rahmen-fachwerk',
		name: 'Truss girder on pylons',
		group: 'rahmen',
		refs: ['36', '06', '38', '43'],
		params: [
			spec('hoehe', 'Elevation', 0.3, 0.9, 0.05, 0.6),
			spec('felder', 'Bays', 2, 8, 1, 5),
			spec('traeger', 'Girder depth m', 1, 4, 0.1, 2.4)
		],
		build(k, p) {
			const z = k.ctx.z + (k.ctx.height - p.traeger) * p.hoehe,
				d = Math.min(k.hv * 2, 2.6),
				t = 1.4;
			return [
				k.box(-k.hu, -t / 2 - d / 2, k.ctx.z, t, t, z - k.ctx.z + p.traeger, k.tone(0), {
					rank: 0
				}),
				k.box(k.hu - t, -t / 2 - d / 2, k.ctx.z, t, t, z - k.ctx.z + p.traeger, k.tone(0), {
					rank: 0
				}),
				k.frame(-k.hu, -d / 2, z, k.hu * 2, d, p.traeger, [p.felder, 1, 1], 0.2, k.tone(1), {
					rank: 1,
					braced: true
				}),
				// Deck of the girder: walkable band.
				k.box(-k.hu, -d / 2, z - 0.25, k.hu * 2, d, 0.25, k.tone(1), { rank: 1 })
			];
		}
	})
];
