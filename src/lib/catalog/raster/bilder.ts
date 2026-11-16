/**
 * Drawing rules of the Grid chapter: translate headless data (logic/bibel) into lines,
 * surfaces and points of the stage (scene/rasterBuehne). Only presentation lives here: token,
 * stroke weight, height. No DOM, no three.js.
 */
import type { Bild, Flaeche, Kreis, Linien } from '../scene/rasterBuehne';
import type { RasterSchichten } from '../logic/bibel/raster';
import type { Teilung, TeilungsBild } from '../logic/bibel/viereckteilung';
import type { SchichtId } from '../data/raster';
import type { Point2 } from '../logic/parametrik/vocab';

/** Outlines as segments (x0, y0, x1, y1, …). */
export function kanten(polygone: readonly Point2[][]): number[] {
	const out: number[] = [];
	for (const p of polygone)
		p.forEach((a, i) => {
			const b = p[(i + 1) % p.length];
			out.push(a[0], a[1], b[0], b[1]);
		});
	return out;
}

/** Lines of a polyline up to the share `t` of its length (drawing pen). */
function teilzug(p: readonly Point2[], t: number): number[] {
	if (t <= 0) return [];
	const n = p.length,
		l = p.map((a, i) => Math.hypot(p[(i + 1) % n][0] - a[0], p[(i + 1) % n][1] - a[1])),
		ziel = l.reduce((s, x) => s + x, 0) * Math.min(1, t),
		out: number[] = [];
	let lauf = 0;
	for (let i = 0; i < n && lauf < ziel; i++) {
		const a = p[i],
			b = p[(i + 1) % n],
			f = Math.min(1, (ziel - lauf) / l[i]);
		out.push(a[0], a[1], a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
		lauf += l[i];
	}
	return out;
}

/** Main simulation: active grid layers. */
export function netzBild(s: RasterSchichten, aktiv: readonly SchichtId[]): Bild {
	const an = (id: SchichtId) => aktiv.includes(id);
	const stadt = an('stadt');
	const linien: Linien[] = [];
	if (an('zellen'))
		linien.push({ key: 'zellen', strecken: kanten(s.zellen), token: '--ink-3', px: 1 });
	if (an('vierecke'))
		linien.push({
			key: 'vierecke',
			strecken: kanten(s.vierecke),
			token: '--blueprint',
			px: 1,
			papier: stadt ? 0.25 : 0
		});
	if (an('bloecke'))
		linien.push({
			key: 'bloecke',
			strecken: kanten(s.bloecke),
			token: '--ink',
			px: stadt ? 1.4 : 2
		});
	const kreise: Kreis[] = an('ecken')
		? [
				...s.gassenecken.map((p) => ({ p, token: '--ink-3', px: 4 })),
				...s.bauecken.map((p) => ({ p, token: '--signal', px: 5 }))
			]
		: [];
	return { linien, kreise };
}

/** Explainer loop quad subdivision: build-up of a shape at the time of the phase. */
export function teilungsBild(t: Teilung, b: TeilungsBild): Bild {
	const linien: Linien[] = [
		{
			key: 'umriss',
			strecken: t.umrisse.flatMap((p) => teilzug(p, b.umriss)),
			token: '--ink',
			px: 2,
			z: 0.2 + 3 * b.hub
		},
		{
			key: 'speichen',
			strecken: t.speichen.flatMap(([m, k]) =>
				b.speichen > 0
					? [m[0], m[1], m[0] + (k[0] - m[0]) * b.speichen, m[1] + (k[1] - m[1]) * b.speichen]
					: []
			),
			token: '--blueprint',
			px: 1.5,
			z: 0.2 + 3 * b.hub
		}
	];
	const flaechen: Flaeche[] =
		b.vierecke > 0
			? t.vierecke.map((polygon, i) => ({
					polygon,
					token: i % 2 ? '--blueprint' : '--paper-3',
					papier: i % 2 ? 1 - 0.32 * b.vierecke : 1 - b.vierecke,
					hoehe: 3 * b.hub,
					z: 0.1
				}))
			: [];
	const kreise: Kreis[] = [
		...(b.mitte > 0
			? t.mitten.map((p) => ({ p, token: '--ink', px: 8 * b.mitte, z: 0.3 + 3 * b.hub }))
			: []),
		...(b.kantenmitten > 0
			? t.kantenmitten.map((k) => ({
					p: k.p,
					token: k.geteilt ? '--signal' : '--blueprint',
					px: (k.geteilt ? 10 : 7) * b.kantenmitten,
					z: 0.3 + 3 * b.hub
				}))
			: [])
	];
	return { linien, flaechen, kreise };
}
