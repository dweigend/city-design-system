/**
 * Sponge city as an explainer loop: a section through a block, seen from the south.
 * Two old buildings with green roofs, between them an open courtyard with a swale, a gravel trench (infiltration trench), a tree
 * and a basin; under the east house the cistern, in the east the flood swale. The section plane lies
 * at y = 0: storages and their water show their front side there.
 *
 * No runoff model: fill levels follow the sequence of the phases (data/stadtBausteine.ts), so that
 * every phase shows exactly one thing. Heavy rain raises all inflows by a factor of 1.6; whatever
 * goes over the edge of a storage flows on. At the end of the loop all storages are back at the start.
 * Everything is a pure function of time and seed.
 */
import { schwammPhasen, type RegenId } from '../../data/stadtBausteine';
import { G, altbau } from './bauten';
import { beam, kiste, strom, stromStufe, type Kiste, type Vec3 } from './kiste';
import { random } from '../parametrik/random';
import { clamp01, cycle, phaseProgress, window01 } from './zeitleiste';
import type { Rahmen } from './rahmen';

export const schwammRahmen: Rahmen = {
	target: [26, 7, 4],
	widthM: 58,
	heightM: 36,
	azimuthDeg: 10,
	elevationDeg: 18
};

/** Depth of the block behind the section plane. */
const D = 14;
const WASSER = strom('water');
const ERDE = '--paper-3';
/** Floors west and east; bottom edge of the section. */
const NW = 3,
	NO = 4,
	UNTEN = -9;
const DACH_W = NW * G + 0.35,
	DACH_O = NO * G + 0.35;

/** Storage: frame in section, fill level 0–1 from below. */
type Speicher = {
	id: string;
	x: number;
	z: number;
	w: number;
	h: number;
	d: number;
	target: string;
};

const SPEICHER = {
	dachWest: { id: 'dach-w', x: 0.4, z: DACH_W, w: 11.2, h: 0.8, d: D - 0.8, target: 'gruendach' },
	dachOst: { id: 'dach-o', x: 37.4, z: DACH_O, w: 11.2, h: 0.8, d: D - 0.8, target: 'gruendach' },
	rigole: { id: 'rigole', x: 14.5, z: -3.4, w: 6, h: 2.8, d: 6, target: 'rigole' },
	becken: {
		id: 'becken',
		x: 24,
		z: -2,
		w: 7,
		h: 2,
		d: D,
		target: 'becken'
	},
	zisterne: { id: 'zisterne', x: 39, z: -6.4, w: 8, h: 5, d: 6, target: 'zisterne' },
	flut: { id: 'flut', x: 31.5, z: -0.8, w: 5.5, h: 0.8, d: D, target: 'flutmulde' }
} satisfies Record<string, Speicher>;

export type Fuellung = Record<keyof typeof SPEICHER, number> & { grundwasser: number };

/** Fill levels 0–1 at time t. */
export function fuellung(timeS: number, regen: RegenId): Fuellung {
	const p = (id: string) => phaseProgress(schwammPhasen, timeS, id);
	const [p1, p2, p3, p4, p5] = ['regen', 'daecher', 'hof', 'becken', 'nutzen'].map(p);
	const k = regen === 'stark' ? 1.6 : 1;
	const leer = 1 - p5;
	const dachRoh = k * (0.5 * p1 + 0.4 * p2);
	const dach = Math.min(1, dachRoh) * leer;
	const zisterne = 0.2 + Math.min(0.8, k * 0.55 * p2 + Math.max(0, dachRoh - 1) * 0.5) * leer;
	const rigole = Math.min(1, k * (0.2 * p2 + 0.75 * p3)) * (1 - 0.45 * p4) * leer;
	const beckenRoh = k * (0.15 * p1 + 0.2 * p3 + 0.65 * p4);
	const becken = 0.2 + 0.8 * Math.min(1, beckenRoh) * leer;
	const flut = clamp01((beckenRoh - 1) / 0.5) * leer;
	const grundwasser = 0.3 + 0.35 * clamp01(p3 * 0.4 + p4 * 0.6) * leer;
	return {
		dachWest: dach,
		dachOst: dach,
		rigole,
		becken,
		zisterne,
		flut: regen === 'stark' ? flut : 0,
		grundwasser
	};
}

/** Open storages show their water surface, closed ones only the water level in section. */
const OFFEN = new Set(['becken', 'flutmulde']);
const RAHMEN: Record<string, string> = {
	gruendach: stromStufe('food', 2),
	flutmulde: stromStufe('food', 2),
	becken: '--paper-3'
};

function speicherKisten(s: Speicher, level: number): Kiste[] {
	const offen = OFFEN.has(s.target);
	// Open storages have no lid: only a bottom, the walls are the ground beside them.
	const out: Kiste[] = [
		kiste(
			`${s.id}-rahmen`,
			[s.x, 0, s.z],
			[s.w, s.d, offen ? 0.15 : s.h],
			RAHMEN[s.target] ?? '--paper',
			{
				edge: '--ink-2',
				target: s.target
			}
		)
	];
	if (level <= 0.01) return out;
	out.push(
		kiste(
			`${s.id}-wasser`,
			[s.x + 0.06, -0.05, s.z + (offen ? 0.15 : 0.04)],
			[s.w - 0.12, offen ? s.d - 0.06 : 0.2, (s.h - 0.17) * level],
			WASSER,
			{ edge: null, flat: true, target: s.target }
		)
	);
	return out;
}

/** Static parts: houses, ground with cutouts, tree, pipes. Built once. */
function statisch(): Kiste[] {
	const k: Kiste[] = [];
	k.push(...altbau('west', 0, 0, 12, D, NW).map((t) => t.k));
	k.push(...altbau('ost', 37, 0, 12, D, NO).map((t) => t.k));
	// Plants on the green roofs.
	for (const [id, x, z] of [
		['w', 0.4, DACH_W],
		['o', 37.4, DACH_O]
	] as const)
		for (let i = 0; i < 5; i++)
			k.push(
				kiste(
					`dach-${id}-pflanze-${i}`,
					[x + 0.8 + i * 2.1, 2 + (i % 2) * 5, z + 0.8],
					[1.4, 1.6, 0.5 + (i % 3) * 0.3],
					strom('food'),
					{ target: 'gruendach' }
				)
			);
	// Ground in section: columns between and under the storages, just behind the section plane.
	const boden = (id: string, x0: number, x1: number, z0: number, z1: number, fill = ERDE) =>
		k.push(kiste(`boden-${id}`, [x0, 0.03, z0], [x1 - x0, D, z1 - z0], fill, { edge: '--ink-3' }));
	boden('a', -2, 14.5, UNTEN, 0);
	boden('b', 14.5, 20.5, UNTEN, -3.4);
	boden('mulde', 14.5, 20.5, -0.6, -0.05, stromStufe('food', 2));
	boden('c', 20.5, 24, UNTEN, 0);
	boden('d', 24, 31, UNTEN, -2);
	boden('e', 31, 31.5, UNTEN, 0);
	boden('f', 31.5, 37, UNTEN, -0.8);
	boden('g', 37, 39, UNTEN, 0);
	boden('h', 39, 47, UNTEN, -6.4);
	boden('i', 39, 47, -1.4, 0);
	boden('j', 47, 54, UNTEN, 0);
	// Open courtyard floor between the west house and the basin.
	k.push(
		kiste('hof', [12, 0.03, -0.02], [12, D, 0.04], stromStufe('food', 2), {
			edge: null,
			target: 'hof'
		})
	);
	// Tree in the courtyard, part of the sponge (evaporates).
	k.push(kiste('baum-stamm', [21.8, 6, 0], [0.5, 0.5, 4], '--ink-3', { target: 'baum' }));
	k.push(kiste('baum-krone', [20, 4.2, 4], [4.2, 4.2, 4.6], strom('food'), { target: 'baum' }));
	// Downpipes, pump line, throttle.
	k.push(
		kiste('rohr-w', [12, 1, 0], [0.35, 0.35, DACH_W + 0.6], '--ink-2', {
			edge: null,
			target: 'fallrohr'
		})
	);
	k.push(
		kiste('rohr-o', [36.65, 1, -1.2], [0.35, 0.35, DACH_O + 1.8], '--ink-2', {
			edge: null,
			target: 'fallrohr'
		})
	);
	k.push(
		kiste('rohr-pumpe', [49, 1, -2], [0.3, 0.3, DACH_O - 1], stromStufe('water', 5), {
			edge: null,
			target: 'zisterne'
		})
	);
	k.push(
		beam('drossel', [31, -0.2], [54, -0.2], -1.15, 0.3, 0.3, '--ink-2', {
			edge: null,
			target: 'becken'
		})
	);
	return k;
}
const STATISCH = statisch();

type Teilchen = { x: number; y: number; off: number };
function streu(seed: number, n: number): Teilchen[] {
	const r = random(seed);
	return Array.from({ length: n }, () => ({ x: r(), y: r(), off: r() }));
}
const TROPFEN = streu(7, 160);
const DAMPF = streu(11, 36);

/** Top edge onto which a drop falls at x. */
const aufprall = (x: number) => (x < 12 ? DACH_W + 1 : x > 37 && x < 49 ? DACH_O + 1 : 0);

/** Packets along a polyline while `aktiv` > 0. */
function strom3(
	id: string,
	p: Vec3[],
	timeS: number,
	n: number,
	periodS: number,
	aktiv: number,
	fill = WASSER
): Kiste[] {
	if (aktiv <= 0.02) return [];
	const out: Kiste[] = [];
	for (let i = 0; i < n; i++) {
		const a = cycle(timeS, periodS, i / n);
		const seg = Math.min(p.length - 2, Math.floor(a * (p.length - 1)));
		const f = a * (p.length - 1) - seg;
		const q = p[seg].map((v, j) => v + (p[seg + 1][j] - v) * f) as Vec3;
		const s = 0.45 * aktiv;
		out.push(
			kiste(`${id}-${i}`, [q[0] - s / 2, q[1] - s / 2, q[2]], [s, s, s], fill, {
				edge: null,
				flat: true
			})
		);
	}
	return out;
}

export function schwammSzene(timeS: number, regen: RegenId, hover?: string): Kiste[] {
	const p = (id: string) => phaseProgress(schwammPhasen, timeS, id);
	const f = fuellung(timeS, regen);
	const stark = regen === 'stark';
	const out: Kiste[] = [...STATISCH];

	// Rain: falls in phase 1, fades out in the first half of phase 2.
	const regnet = p('regen') > 0 && p('daecher') < 0.5 ? 1 - window01(p('daecher'), 0, 0.5) : 0;
	const n = Math.round((stark ? 160 : 70) * regnet);
	for (let i = 0; i < n; i++) {
		const d = TROPFEN[i];
		const x = -2 + d.x * 56;
		const top = 30;
		const z = top - cycle(timeS, stark ? 1.4 : 2.2, d.off) * (top - aufprall(x));
		out.push(
			kiste(
				`regen-${i}`,
				[x, 0.5 + d.y * (D - 1), z],
				[0.08, 0.08, stark ? 1.3 : 0.8],
				stromStufe('water', 3),
				{ edge: null, flat: true }
			)
		);
	}

	for (const [key, s] of Object.entries(SPEICHER) as [keyof typeof SPEICHER, Speicher][])
		out.push(...speicherKisten(s, f[key]));
	// Groundwater as a band at the bottom of the section.
	out.push(
		kiste(
			'grundwasser',
			[-2, -0.05, UNTEN],
			[56, 0.2, 3.2 * f.grundwasser],
			stromStufe('water', 2),
			{ edge: null, flat: true, target: 'grundwasser' }
		)
	);

	// Downpipes in phase 2, infiltration in 3, throttle in 4, pump in 5.
	const fall = window01(p('regen'), 0.5, 1) * (1 - window01(p('hof'), 0.2, 0.6));
	out.push(
		...strom3(
			'fall-w',
			[
				[12.2, 1.2, DACH_W],
				[12.2, 1.2, 0.2],
				[15.5, 1.2, 0.1]
			],
			timeS,
			6,
			1.4,
			fall
		)
	);
	out.push(
		...strom3(
			'fall-o',
			[
				[36.8, 1.2, DACH_O],
				[36.8, 1.2, -0.2],
				[36.8, -0.1, -1],
				[40, -0.1, -1.6]
			],
			timeS,
			7,
			1.6,
			fall
		)
	);
	const sicker = p('hof') > 0 && p('becken') < 1 ? 1 - window01(p('becken'), 0.6, 1) : 0;
	out.push(
		...strom3(
			'sicker-a',
			[
				[16, -0.1, 0],
				[16, -0.1, -3.4]
			],
			timeS,
			3,
			1.8,
			sicker
		)
	);
	out.push(
		...strom3(
			'sicker-b',
			[
				[19, -0.1, 0],
				[19, -0.1, -3.4]
			],
			timeS,
			3,
			2.1,
			sicker
		)
	);
	out.push(
		...strom3(
			'sicker-c',
			[
				[17.5, -0.1, -3.6],
				[17.5, -0.1, -7.4]
			],
			timeS,
			3,
			2.6,
			sicker * 0.8
		)
	);
	const drossel = p('becken') > 0 && p('nutzen') < 0.6 ? 0.6 : 0;
	out.push(
		...strom3(
			'drossel',
			[
				[31, -0.25, -1.15],
				[54, -0.25, -1.15]
			],
			timeS,
			4,
			6,
			drossel
		)
	);
	if (stark && f.flut > 0.02)
		out.push(
			...strom3(
				'ueberlauf',
				[
					[30.6, 2, 0.05],
					[33.5, 2, -0.5]
				],
				timeS,
				4,
				1.2,
				Math.min(1, f.flut * 3)
			)
		);
	const pumpe = p('nutzen') > 0 && p('nutzen') < 1 ? 1 : 0;
	out.push(
		...strom3(
			'pumpe',
			[
				[43, -0.1, -2],
				[49.15, -0.1, -1.6],
				[49.15, 1.2, -0.2],
				[49.15, 1.2, DACH_O - 3]
			],
			timeS,
			6,
			2.6,
			pumpe,
			stromStufe('water', 5)
		)
	);

	// Evaporation: rises from roofs, tree and basin, gets smaller and vanishes.
	const dampf = window01(p('nutzen'), 0.1, 0.4) * (1 - window01(p('nutzen'), 0.85, 1));
	if (dampf > 0)
		DAMPF.forEach((d, i) => {
			const quelle: Vec3 = [
				[1 + d.x * 10, 2 + d.y * 9, DACH_W + 1.2],
				[38 + d.x * 10, 2 + d.y * 9, DACH_O + 1.2],
				[20 + d.x * 4, 4 + d.y * 4, 8.6],
				[24.5 + d.x * 6, 1 + d.y * 7, 0.2]
			][i % 4] as Vec3;
			const a = cycle(timeS, 3.2, d.off);
			const s = 0.55 * (1 - a) * dampf;
			if (s > 0.05)
				out.push(
					kiste(
						`dampf-${i}`,
						[quelle[0], quelle[1], quelle[2] + a * 7],
						[s, s, s],
						stromStufe('water', 1),
						{ edge: stromStufe('water', 3), alpha: 0.6 }
					)
				);
		});

	if (!hover) return out;
	return out.map((k) => (k.target === hover && k.edge ? { ...k, edge: '--signal' } : k));
}

/** Anchor points for labels: the label stands below the point (storages: below the front side). */
export const schwammAnker: Record<string, Vec3> = {
	gruendach: [6, 0, DACH_W + 4.5],
	rigole: [17.5, 0, -3.4],
	becken: [27.5, 0, -2],
	flutmulde: [34.25, 0, -0.8],
	zisterne: [43, 0, -6.4],
	baum: [22, 6, 10.2]
};
