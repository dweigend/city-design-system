import type { Primitive } from '../types';
import { family, spec } from './kit';

/** Arch: portal, arcade, barrel vault, halfpipe (22, 24, 149, R16-01). */
export const bogen = [
	family({
		id: 'bogen-portal',
		name: 'Portal',
		group: 'bogen',
		refs: ['22', 'R16-01'],
		params: [
			spec('hoehe', 'Height', 0.3, 1, 0.05, 0.8),
			spec('tiefe', 'Depth', 0.1, 1, 0.05, 0.35),
			spec('wand', 'Wall thickness', 0.1, 0.45, 0.01, 0.22)
		],
		build(k, p) {
			const w = k.hu * 2,
				t = w * p.wand,
				H = k.ctx.height * p.hoehe,
				d = k.hv * 2 * p.tiefe;
			return [
				k.arch('arch', 0, -k.hv + d / 2, k.ctx.z, w, d, H, k.tone(0), { thickness: t, rank: 0 }),
				// Back wall: a flat disc behind the opening (Memphis backdrop).
				k.box(-w / 2 + t, k.hv - 0.4, k.ctx.z, w - 2 * t, 0.4, H * 0.66, k.tone(1), { rank: 0 })
			];
		}
	}),
	family({
		id: 'bogen-arkade',
		name: 'Arcade',
		group: 'bogen',
		refs: ['149', '24', '38'],
		params: [
			spec('boegen', 'Arches', 2, 7, 1, 4),
			spec('stich', 'Rise', 0.4, 1.2, 0.05, 0.8),
			spec('geschoss', 'Upper story', 0, 1, 1, 1)
		],
		build(k, p) {
			const out: Primitive[] = [],
				w = (k.hu * 2) / p.boegen,
				d = Math.min(k.hv * 2, 4),
				rise = Math.min(w * p.stich + w * 0.6, k.ctx.height * 0.6);
			for (let i = 0; i < p.boegen; i++)
				out.push(
					k.arch('arch', -k.hu + w * (i + 0.5), -k.hv + d / 2, k.ctx.z, w, d, rise, k.tone(0), {
						thickness: w * 0.14,
						rank: 0
					})
				);
			if (p.geschoss)
				out.push(
					k.box(
						-k.hu,
						-k.hv,
						k.ctx.z + rise,
						k.hu * 2,
						d,
						Math.min(k.ctx.height - rise, rise * 0.9),
						k.tone(1),
						{ rank: 1 }
					)
				);
			return out;
		}
	}),
	family({
		id: 'bogen-tonne',
		name: 'Barrel vault',
		group: 'bogen',
		refs: ['24', 'R20-06'],
		params: [
			spec('stich', 'Rise', 0.2, 1, 0.05, 0.5),
			spec('sockel', 'Plinth', 0, 0.6, 0.05, 0.3),
			spec('quer', 'Cross axis', 0, 1, 1, 0)
		],
		build(k, p) {
			const along = !p.quer,
				w = (along ? k.hv : k.hu) * 2,
				l = (along ? k.hu : k.hv) * 2,
				base = k.ctx.height * p.sockel,
				rise = Math.min((w / 2) * p.stich * 2, k.ctx.height - base);
			const out: Primitive[] = [];
			if (base > 0.3)
				out.push(k.box(-k.hu, -k.hv, k.ctx.z, k.hu * 2, k.hv * 2, base, k.tone(1), { rank: 0 }));
			out.push(
				k.arch('vault', 0, 0, k.ctx.z + base, w, l, rise, k.tone(0), {
					rank: 1,
					turn: along ? Math.PI / 2 : 0
				})
			);
			return out;
		}
	}),
	family({
		id: 'bogen-halfpipe',
		name: 'Halfpipe',
		group: 'bogen',
		refs: ['22', '07', '149'],
		params: [
			spec('stich', 'Rise', 0.2, 1, 0.05, 0.6),
			spec('stelzen', 'Stilts', 0, 0.6, 0.05, 0.25),
			spec('schale', 'Shell m', 0.2, 1.5, 0.05, 0.5)
		],
		build(k, p) {
			const w = k.hv * 2,
				l = k.hu * 2,
				lift = k.ctx.height * p.stelzen,
				rise = Math.min((w / 2) * p.stich, k.ctx.height - lift),
				out: Primitive[] = [];
			if (lift > 0.3)
				for (const u of [-k.hu * 0.7, k.hu * 0.7])
					for (const v of [-k.hv * 0.4, k.hv * 0.4])
						out.push(
							k.cylinder(u, v, k.ctx.z, 0.3, lift + rise * 0.2, '--paper', {
								rank: 0,
								material: 'metal'
							})
						);
			out.push(
				k.arch('halfpipe', 0, 0, k.ctx.z + lift, w, l, rise, k.tone(0), {
					thickness: p.schale,
					rank: 1,
					turn: Math.PI / 2
				})
			);
			return out;
		}
	})
];
