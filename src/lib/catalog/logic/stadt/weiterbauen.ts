/**
 * Building on existing stock as a small city: four starting situations, three steps.
 * Retain (0) shows only existing stock, convert (1) colors floors in the old building, extend (2) adds
 * new parts. Every part belongs to exactly one step; the running step grows with f from below.
 * People walk on fixed paths; their position is a pure function of time.
 * Dimensions in meters, floor 3.5 m in the old building, 3.2 m in the new build.
 */
import type { LageId } from '../../data/stadtBausteine';
import {
	BESTAND,
	beam,
	grow,
	kiste,
	present,
	strom,
	stromStufe,
	type Kiste,
	type Vec3
} from './kiste';
import { cycle } from './zeitleiste';
import type { Rahmen } from './rahmen';
import { G, GN, altbau, b, baum, e, grund, u, type Teil } from './bauten';

type Weg = { punkte: Vec3[]; leute: number; periodS: number; stufe: 0 | 1 | 2 };
type Lage = { teile: Teil[]; wege: Weg[]; rahmen: Rahmen };

/** Light rooftop extension: modules between darker slabs, set back. */
function aufstockung(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	z0: number,
	n: number,
	ton = 'people' as const
): Teil[] {
	const out: Teil[] = [];
	for (let g = 0; g < n; g++) {
		const z = z0 + g * GN;
		out.push(
			e(
				kiste(`${id}-decke-${g}`, [x, y, z], [w, d, 0.35], '--paper', {
					target: 'aufstockung'
				})
			)
		);
		out.push(
			e(
				kiste(
					`${id}-modul-${g}`,
					[x + 0.5, y + 0.8, z + 0.35],
					[w - 1, d - 1.6, GN - 0.35],
					strom(ton),
					{ target: 'aufstockung' }
				)
			)
		);
	}
	out.push(
		e(
			kiste(`${id}-decke-top`, [x, y, z0 + n * GN], [w, d, 0.35], '--paper', {
				target: 'aufstockung'
			})
		)
	);
	return out;
}

/** Solar field: rows of flat panels on supports. */
function solar(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	z: number,
	target = 'solar'
): Teil[] {
	const out: Teil[] = [];
	const reihen = Math.max(2, Math.floor(d / 2.6));
	for (let r = 0; r < reihen; r++)
		out.push(
			e(
				kiste(
					`${id}-${r}`,
					[x + 0.4, y + 0.4 + (r * (d - 0.8)) / reihen, z + 0.5],
					[w - 0.8, (d - 0.8) / reihen - 0.5, 0.18],
					strom('energy'),
					{ target }
				)
			)
		);
	return out;
}

/** Frame tower: four columns in ink, one module per floor, slightly offset. */
function turm(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	n: number,
	ton: (g: number) => 'people' | 'material',
	target = 'turm'
): Teil[] {
	const out: Teil[] = [];
	const h = n * GN;
	for (const [px, py] of [
		[x, y],
		[x + w - 0.4, y],
		[x, y + d - 0.4],
		[x + w - 0.4, y + d - 0.4]
	])
		out.push(
			e(kiste(`${id}-stuetze-${px}-${py}`, [px, py, 0], [0.4, 0.4, h + 0.4], '--ink', { target }))
		);
	for (let g = 0; g < n; g++) {
		const versatz = g % 2 ? 0.6 : -0.6;
		out.push(e(kiste(`${id}-decke-${g}`, [x, y, g * GN], [w, d, 0.3], '--paper', { target })));
		out.push(
			e(
				kiste(
					`${id}-modul-${g}`,
					[x + 0.7 + versatz, y + 0.9, g * GN + 0.3],
					[w - 1.4, d - 1.8, GN - 0.5],
					strom(ton(g)),
					{ target }
				)
			)
		);
	}
	out.push(e(kiste(`${id}-decke-top`, [x, y, n * GN], [w, d, 0.3], '--paper', { target })));
	return out;
}

function zeile(): Lage {
	const hs: [number, number, number][] = [
		[0, 10, 5],
		[10, 9, 4],
		[19, 11, 5],
		[30, 10, 4]
	];
	const y = 8,
		d = 12;
	const teile: Teil[] = [grund('gasse', -4, -2, 48, 10, '--paper'), grund('hinten', -4, 8, 48, 18)];
	hs.forEach(([x, w, n], i) =>
		teile.push(
			...altbau(`h${i}`, x, y, w, d, n, {
				umbau:
					i === 0
						? [{ geschoss: 0, fill: strom('material'), target: 'werkstatt' }]
						: i === 2
							? [{ geschoss: 0, fill: strom('food'), target: 'markt' }]
							: []
			})
		)
	);
	teile.push(...baum('b0', 5, 3), ...baum('b1', 17, 3), ...baum('b2', 31, 3));
	for (const i of [0, 1, 2]) {
		const [x, w, n] = hs[i];
		teile.push(...aufstockung(`a${i}`, x + 0.4, y + 1, w - 0.8, d - 1.4, n * G + 0.35, 2));
		teile.push(...solar(`s${i}`, x + 0.4, y + 1, w - 0.8, d - 1.4, n * G + 0.35 + 2 * GN + 0.35));
	}
	const [x3, w3, n3] = hs[3];
	teile.push(
		e(
			kiste(
				'garten-erde',
				[x3 + 1, y + 1, n3 * G + 0.35],
				[w3 - 2, d - 2, 0.5],
				stromStufe('food', 3),
				{ target: 'dachgarten' }
			)
		)
	);
	for (let i = 0; i < 4; i++)
		teile.push(
			e(
				kiste(
					`garten-${i}`,
					[x3 + 1.6 + (i % 2) * 4, y + 2 + Math.floor(i / 2) * 5, n3 * G + 0.85],
					[2.6, 3, 1 + (i % 3) * 0.4],
					strom('food'),
					{ target: 'dachgarten' }
				)
			)
		);
	return {
		teile,
		wege: [
			{
				punkte: [
					[-3, 1.5, 0],
					[43, 1.5, 0]
				],
				leute: 4,
				periodS: 26,
				stufe: 0
			},
			{
				punkte: [
					[43, 5.5, 0],
					[-3, 5.5, 0]
				],
				leute: 3,
				periodS: 30,
				stufe: 0
			}
		],
		rahmen: { target: [20, 12, 11], widthM: 50, heightM: 38, azimuthDeg: 28 }
	};
}

function luecke(): Lage {
	const y = 8,
		d = 12;
	const teile: Teil[] = [grund('gasse', -4, -2, 58, 10, '--paper'), grund('hinten', -4, 8, 58, 18)];
	teile.push(...altbau('h0', 0, y, 10, d, 5, { mansarde: true }));
	teile.push(...altbau('h1', 10, y, 10, d, 5));
	teile.push(grund('brache', 20, y, 10, d, '--paper-3', 'brache'));
	teile.push(
		b(
			kiste('brache-busch-0', [22, y + 3, 0], [2, 2, 1.2], BESTAND.fill, {
				edge: BESTAND.edge,
				target: 'brache'
			})
		)
	);
	teile.push(
		b(
			kiste('brache-busch-1', [26, y + 7, 0], [2.4, 2, 0.9], BESTAND.fill, {
				edge: BESTAND.edge,
				target: 'brache'
			})
		)
	);
	teile.push(
		...altbau('h2', 30, y, 11, d, 5, {
			umbau: [{ geschoss: 0, fill: strom('water'), target: 'wasserwerk' }]
		})
	);
	teile.push(...altbau('h3', 41, y, 9, d, 4, { mansarde: true }));
	teile.push(...turm('t', 20.5, y + 0.5, 9, d - 1, 8, () => 'people'));
	teile.push(...solar('s', 20.5, y + 0.5, 9, d - 1, 8 * GN + 0.3));
	// Footbridge at the neighbor's eaves height (5 floors = 17.5 m) from the tower onto the roof.
	teile.push(
		e(
			beam('steg', [15, y + 6], [21, y + 6], 5 * G + 0.35, 2.4, 0.4, strom('people'), {
				target: 'steg'
			})
		)
	);
	return {
		teile,
		wege: [
			{
				punkte: [
					[-3, 2, 0],
					[53, 2, 0]
				],
				leute: 4,
				periodS: 30,
				stufe: 0
			},
			{
				punkte: [
					[53, 5.5, 0],
					[-3, 5.5, 0]
				],
				leute: 3,
				periodS: 34,
				stufe: 0
			},
			{
				punkte: [
					[12, y + 6, 5 * G + 0.75],
					[24, y + 6, 5 * G + 0.75]
				],
				leute: 2,
				periodS: 12,
				stufe: 2
			}
		],
		rahmen: { target: [25, 13, 12], widthM: 58, heightM: 44, azimuthDeg: 28 }
	};
}

function hof(): Lage {
	const teile: Teil[] = [grund('vorn', -4, -4, 44, 10, '--paper'), grund('ring', -4, 6, 44, 32)];
	teile.push(...altbau('h-nord', 0, 24, 36, 10, 4, { mansarde: true }));
	teile.push(...altbau('h-west', 0, 6, 10, 18, 4));
	teile.push(...altbau('h-ost', 26, 6, 10, 18, 4));
	teile.push(
		b(
			kiste('hof-boden', [10, 6, -0.25], [16, 18, 0.27], '--paper-3', {
				edge: BESTAND.edge,
				target: 'haus'
			})
		)
	);
	teile.push(
		u(
			kiste('hof-offen', [10.3, 6.3, -0.2], [15.4, 17.4, 0.26], stromStufe('water', 2), {
				edge: strom('water'),
				target: 'entsiegelt'
			})
		)
	);
	teile.push(...altbau('schuppen', 14, 18, 8, 5, 1, { target: 'schuppen' }).slice(0, 2));
	teile.push(
		u(
			kiste('glasdach', [13.8, 17.8, G], [8.4, 5.4, 1.6], stromStufe('food', 3), {
				alpha: 0.6,
				target: 'gewaechshaus'
			})
		)
	);
	teile.push(
		e(
			kiste('becken', [11.5, 8, -0.1], [6, 5, 0.25], strom('water'), {
				flat: true,
				target: 'becken'
			})
		)
	);
	for (let i = 0; i < 4; i++)
		teile.push(
			e(
				kiste(
					`beet-${i}`,
					[19 + (i % 2) * 3.2, 8 + Math.floor(i / 2) * 3.6, 0],
					[2.4, 2.6, 0.7],
					strom('food'),
					{ target: 'beete' }
				)
			)
		);
	teile.push(
		e(beam('galerie', [10, 15], [26, 15], 8, 2.4, 0.4, strom('people'), { target: 'galerie' }))
	);
	return {
		teile,
		wege: [
			{
				punkte: [
					[-2, 0, 0],
					[38, 0, 0]
				],
				leute: 3,
				periodS: 28,
				stufe: 0
			},
			{
				punkte: [
					[18, 1, 0],
					[18, 16, 0],
					[12, 16, 0]
				],
				leute: 2,
				periodS: 20,
				stufe: 1
			},
			{
				punkte: [
					[11, 15, 8.4],
					[25, 15, 8.4]
				],
				leute: 2,
				periodS: 12,
				stufe: 2
			}
		],
		rahmen: { target: [18, 16, 6], widthM: 46, heightM: 35, azimuthDeg: 24 }
	};
}

function gasse(): Lage {
	const teile: Teil[] = [
		grund('gasse', 12, -6, 10, 40, '--paper', 'gasse'),
		grund('west', -4, -6, 16, 40),
		grund('ost', 22, -6, 16, 40)
	];
	teile.push(
		...altbau('h0', 0, 4, 12, 14, 5, {
			mansarde: true,
			umbau: [{ geschoss: 2, fill: strom('people'), target: 'gemeinschaft' }]
		})
	);
	teile.push(...altbau('h1', 0, 18, 12, 12, 4));
	teile.push(grund('parzelle', 22, 4, 12, 12, '--paper-3'));
	teile.push(...turm('t', 23, 4.5, 10, 11, 7, (g) => (g < 2 ? 'material' : 'people')));
	teile.push(
		e(beam('bruecke', [12, 11], [23, 11], 8, 2.4, 0.5, strom('people'), { target: 'bruecke' }))
	);
	teile.push(
		e(kiste('treppe', [19, 13.5, 0], [3, 3, 8.5], stromStufe('people', 3), { target: 'treppe' }))
	);
	teile.push(...baum('b0', 17, 24));
	return {
		teile,
		wege: [
			{
				punkte: [
					[14, -5, 0],
					[14, 33, 0]
				],
				leute: 3,
				periodS: 24,
				stufe: 0
			},
			{
				punkte: [
					[20, 33, 0],
					[20, -5, 0]
				],
				leute: 2,
				periodS: 28,
				stufe: 0
			},
			{
				punkte: [
					[12.5, 11, 8.5],
					[24, 11, 8.5]
				],
				leute: 2,
				periodS: 10,
				stufe: 2
			}
		],
		rahmen: { target: [17, 14, 10], widthM: 40, heightM: 32, azimuthDeg: 18 }
	};
}

const BAU: Record<LageId, () => Lage> = { zeile, luecke, hof, gasse };
const CACHE = new Map<LageId, Lage>();
function lage(id: LageId): Lage {
	let l = CACHE.get(id);
	if (!l) CACHE.set(id, (l = BAU[id]()));
	return l;
}

/** Point on a polyline at share a (0–1, by length). */
function along(p: Vec3[], a: number): Vec3 {
	const seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]));
	let rest = a * seg.reduce((s, l) => s + l, 0);
	for (let i = 0; i < seg.length; i++) {
		if (rest <= seg[i] || i === seg.length - 1) {
			const f = seg[i] ? Math.min(1, rest / seg[i]) : 0;
			return [0, 1, 2].map((k) => p[i][k] + (p[i + 1][k] - p[i][k]) * f) as Vec3;
		}
		rest -= seg[i];
	}
	return p[0];
}

export const weiterbauenRahmen = (id: LageId): Rahmen => lage(id).rahmen;

/** All targets of a situation with an anchor point (center of the topmost box), for labels. */
export function anker(id: LageId): Record<string, Vec3> {
	const out: Record<string, Vec3> = {};
	for (const { k } of lage(id).teile)
		if (k.target) {
			const top: Vec3 = [k.p[0] + k.s[0] / 2, k.p[1] + k.s[1] / 2, k.p[2] + k.s[2]];
			if (!out[k.target] || top[2] > out[k.target][2]) out[k.target] = top;
		}
	return out;
}

/**
 * Image of a situation: step `stufe` (0–2) has grown to share `f`, earlier ones stand complete.
 * `hover` highlights a target with a signal edge.
 */
export function weiterbauenSzene(
	id: LageId,
	stufe: number,
	f: number,
	timeS: number,
	hover?: string
): Kiste[] {
	const l = lage(id);
	const kisten = present(
		l.teile.map(({ k, stufe: s }) => {
			const sichtbar = s < stufe ? 1 : s === stufe ? f : 0;
			const g = s === 0 ? k : grow(k, sichtbar);
			if (!g) return null;
			return hover && k.target === hover && k.edge ? { ...g, edge: '--signal' } : g;
		})
	);
	for (const [w, weg] of l.wege.entries()) {
		if (weg.stufe > stufe || (weg.stufe === stufe && f < 1)) continue;
		for (let i = 0; i < weg.leute; i++) {
			const [x, y, z] = along(weg.punkte, cycle(timeS, weg.periodS, i / weg.leute + w * 0.13));
			kisten.push(
				kiste(`mensch-${w}-${i}`, [x - 0.3, y - 0.3, z], [0.6, 0.6, 1.8], strom('people'), {
					edge: null,
					flat: true
				})
			);
		}
	}
	return kisten;
}
