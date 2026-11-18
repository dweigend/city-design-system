import type { Primitive } from '../types';
import type { Kit } from './kit';
import { family, spec } from './kit';
import type { Point2 } from '../vocab';

const B = { role: 'bestand' as const };

/** Punched facade on every footprint edge: windows as thin dark boxes, rotated to the edge. */
function windows(
	k: Kit,
	poly: Point2[],
	z0: number,
	floors: number,
	fh: number,
	pitch: number,
	out: Primitive[]
) {
	for (let i = 0; i < poly.length; i++) {
		const [ax, ay] = poly[i],
			[bx, by] = poly[(i + 1) % poly.length],
			len = Math.hypot(bx - ax, by - ay),
			a = Math.atan2(by - ay, bx - ax),
			n = Math.floor((len - 1) / pitch);
		if (n < 1) continue;
		const pad = (len - n * pitch) / 2;
		for (let f = 0; f < floors; f++)
			for (let j = 0; j < n; j++) {
				const t = (pad + (j + 0.5) * pitch) / len,
					x = ax + (bx - ax) * t,
					y = ay + (by - ay) * t,
					// Slightly outside the wall plane so the window reads as a dark patch.
					ox = Math.sin(a) * 0.02,
					oy = -Math.cos(a) * 0.02;
				out.push({
					...k.box(0, 0, 0, 1, 1, 1, '--paper', { ...B, shade: 0.24, detail: true, rank: -1 }),
					kind: 'box',
					position: [x + ox - 0.6, y + oy - 0.04, z0 + f * fh + fh * 0.28],
					size: [1.2, 0.08, fh * 0.55],
					rotation: a
				});
			}
	}
}

/** Existing stock: perimeter block, gable house, shed hall, viaduct (33, 36, 37, 38, 10). Always gray. */
export const bestand = [
	family({
		id: 'bestand-block',
		name: 'Perimeter block with punched facade',
		group: 'bestand',
		refs: ['33', '37', '41'],
		params: [
			spec('geschosse', 'Floors', 2, 7, 1, 4),
			spec('rhythmus', 'Window bay m', 1.8, 4, 0.1, 2.5),
			spec('gesims', 'Cornice', 0, 1, 1, 1)
		],
		build(k, p) {
			const fh = Math.min(3.8, k.ctx.height / p.geschosse),
				poly = k.outline(0.4),
				H = fh * p.geschosse,
				out: Primitive[] = [k.prism(poly, k.ctx.z, H, '--paper', { ...B, rank: -1 })];
			if (p.gesims) {
				out.push(k.prism(k.outline(0.2), k.ctx.z, 0.7, '--paper', { ...B, rank: -1, shade: 0.1 }));
				out.push(
					k.prism(k.outline(0.15), k.ctx.z + H - 0.5, 0.5, '--paper', {
						...B,
						rank: -1,
						shade: 0.1
					})
				);
			}
			windows(k, poly, k.ctx.z, p.geschosse, fh, p.rhythmus, out);
			return out;
		}
	}),
	family({
		id: 'bestand-giebel',
		name: 'Gable house',
		group: 'bestand',
		refs: ['36', '43', '10'],
		params: [
			spec('geschosse', 'Floors', 1, 5, 1, 3),
			spec('neigung', 'Roof pitch', 0.4, 1.4, 0.05, 0.9),
			spec('traufseitig', 'Eaves to alley', 0, 1, 1, 0)
		],
		build(k, p) {
			const along = !!p.traufseitig,
				w = (along ? k.hv : k.hu) * 2,
				fh = 3.2,
				H = Math.min(fh * p.geschosse, k.ctx.height * 0.6),
				roof = Math.min((w / 2) * p.neigung, k.ctx.height - H),
				out: Primitive[] = [
					k.box(-k.hu, -k.hv, k.ctx.z, k.hu * 2, k.hv * 2, H, '--paper', { ...B, rank: -1 })
				];
			// Gable: two mirrored wedges meeting at the ridge.
			if (along) {
				out.push(
					k.wedge(-k.hu, 0, k.ctx.z + H, k.hu * 2, k.hv, roof, 0, '--paper', {
						...B,
						rank: -1,
						turn: -Math.PI / 2,
						shade: 0.12
					})
				);
				out.push(
					k.wedge(-k.hu, -k.hv, k.ctx.z + H, k.hu * 2, k.hv, roof, 0, '--paper', {
						...B,
						rank: -1,
						turn: Math.PI / 2,
						shade: 0.12
					})
				);
			} else {
				out.push(
					k.wedge(0, -k.hv, k.ctx.z + H, k.hu, k.hv * 2, roof, 0, '--paper', {
						...B,
						rank: -1,
						shade: 0.12
					})
				);
				out.push(
					k.wedge(-k.hu, -k.hv, k.ctx.z + H, k.hu, k.hv * 2, roof, 0, '--paper', {
						...B,
						rank: -1,
						turn: Math.PI,
						shade: 0.12
					})
				);
			}
			const corners: Point2[] = [
				k.world(-k.hu, -k.hv),
				k.world(k.hu, -k.hv),
				k.world(k.hu, k.hv),
				k.world(-k.hu, k.hv)
			];
			windows(k, corners, k.ctx.z, Math.round(H / fh), H / Math.round(H / fh), 2.4, out);
			out.push(
				k.box(k.hu * 0.4, -0.4, k.ctx.z + H, 0.8, 0.8, roof * 0.9, '--paper', {
					...B,
					rank: -1,
					shade: 0.1
				})
			);
			return out;
		}
	}),
	family({
		id: 'bestand-shedhalle',
		name: 'Hall with sawtooth roof',
		group: 'bestand',
		refs: ['38', '10', '33'],
		params: [
			spec('sheds', 'Sheds', 2, 8, 1, 4),
			spec('hoehe', 'Eaves m', 3, 10, 0.5, 6),
			spec('schlot', 'Chimney', 0, 1, 1, 1)
		],
		build(k, p) {
			const H = Math.min(p.hoehe, k.ctx.height * 0.6),
				poly = k.outline(0.3),
				s = (k.hu * 2) / p.sheds,
				out: Primitive[] = [k.prism(poly, k.ctx.z, H, '--paper', { ...B, rank: -1 })];
			for (let i = 0; i < p.sheds; i++)
				out.push(
					k.wedge(-k.hu + i * s, -k.hv, k.ctx.z + H, s, k.hv * 2, s * 0.6, 0, '--paper', {
						...B,
						rank: -1,
						turn: Math.PI,
						shade: 0.1
					})
				);
			if (p.schlot)
				out.push(
					k.cylinder(k.hu * 0.6, k.hv * 0.5, k.ctx.z, 0.6, k.ctx.height, '--paper', {
						...B,
						rank: -1
					})
				);
			windows(k, poly, k.ctx.z, 1, H, 3.2, out);
			return out;
		}
	}),
	family({
		id: 'bestand-viadukt',
		name: 'Viaduct',
		group: 'bestand',
		refs: ['38', '33', '149'],
		params: [
			spec('boegen', 'Arches', 2, 8, 1, 4),
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.55),
			spec('tiefe', 'Depth m', 2, 8, 0.1, 4)
		],
		build(k, p) {
			const w = (k.hu * 2) / p.boegen,
				H = k.ctx.height * p.hoehe,
				d = Math.min(p.tiefe, k.hv * 2),
				out: Primitive[] = [];
			for (let i = 0; i < p.boegen; i++)
				out.push(
					k.arch('arch', -k.hu + w * (i + 0.5), 0, k.ctx.z, w, d, H, '--paper', {
						...B,
						rank: -1,
						thickness: w * 0.16
					})
				);
			out.push(
				k.box(-k.hu - 0.2, -d / 2 - 0.2, k.ctx.z + H, k.hu * 2 + 0.4, d + 0.4, 0.6, '--paper', {
					...B,
					rank: -1,
					shade: 0.1
				})
			);
			return out;
		}
	})
];
