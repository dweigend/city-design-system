/**
 * Component passport as three explainer loops. An instance is a concrete part with a number; it travels,
 * is stored, taken apart or newly joined and stays the same part throughout. The instance carries the
 * color of the Material flow; everything else stays existing stock (gray) or structural frame (ink).
 *
 * Every scene is a pure function of time: tracks are keyframes with a smooth transition,
 * flights rise in an arc. Size changes in flight (a strip becomes a stringer) are intended:
 * they show the cutting, without rotation about horizontal axes.
 */
import { bauteilLoops, type BauteilLoopId } from '../../data/stadtBausteine';
import { G, altbau } from './bauten';
import { BESTAND, kiste, lerp3, strom, stromStufe, type Kiste, type Vec3 } from './kiste';
import { phaseProgress, smooth, window01 } from './zeitleiste';
import type { Rahmen } from './rahmen';

export type BauteilBild = {
	kisten: Kiste[];
	/** Center of the instance, for the line to the passport. */
	exemplar: Vec3;
};

const MAT = strom('material');
const MAT_HELL = stromStufe('material', 3);
const MAT_DUNKEL = stromStufe('material', 5);
const GLAS = '--paper-2';

/** Arc flight from a to b with apex height h. */
function flug(a: Vec3, b: Vec3, f: number, h: number): Vec3 {
	const s = smooth(f);
	const p = lerp3(a, b, s);
	return [p[0], p[1], p[2] + Math.sin(Math.PI * s) * h];
}

const fortschritt = (id: BauteilLoopId) => {
	const phasen = bauteilLoops.find((l) => l.value === id)?.phasen ?? [];
	return (timeS: number, phase: string) => phaseProgress(phasen, timeS, phase);
};

/** Storage rack: frame in ink, shelves as paper. */
function regal(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	faecher: number,
	h: number
): Kiste[] {
	const out: Kiste[] = [];
	for (const [px, py] of [
		[x, y],
		[x + w - 0.08, y],
		[x, y + d - 0.08],
		[x + w - 0.08, y + d - 0.08]
	])
		out.push(
			kiste(`${id}-pfosten-${px}-${py}`, [px, py, 0], [0.08, 0.08, h * faecher + 0.1], '--ink', {
				edge: null
			})
		);
	for (let i = 0; i <= faecher; i++)
		out.push(
			kiste(`${id}-boden-${i}`, [x, y, i * h], [w, d, 0.06], '--paper', { edge: '--ink-2' })
		);
	return out;
}

/* ── Window ───────────────────────────────────────────────────────────── */

const FW = 1.1,
	FH = 1.8;
const F_ALT: Vec3 = [3.45, -0.08, G + 0.9];
const F_LAGER: Vec3 = [11.55, 1.6, 0.12];
const F_TURM: Vec3 = [19.95, -0.08, 3.2 + 0.75];

function fensterKisten(p: Vec3, hervor: boolean): Kiste[] {
	const t = { target: 'exemplar', edge: hervor ? '--signal' : '--ink' };
	return [
		kiste('f-rahmen', p, [FW, 0.14, FH], MAT, t),
		kiste('f-fluegel-l', [p[0] + 0.1, p[1] - 0.02, p[2] + 0.12], [0.42, 0.04, FH - 0.24], GLAS, t),
		kiste(
			'f-fluegel-r',
			[p[0] + FW - 0.52, p[1] - 0.02, p[2] + 0.12],
			[0.42, 0.04, FH - 0.24],
			GLAS,
			t
		)
	];
}

/** Four screws at the corners; `aus` 0 = fixed, 1 = unscrewed and gone. */
function schrauben(p: Vec3, aus: number): Kiste[] {
	if (aus >= 1) return [];
	const s = 0.14 * (1 - window01(aus, 0.6, 1));
	const weg = 0.5 * smooth(aus);
	return [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1]
	].map(([i, j], n) =>
		kiste(
			`f-schraube-${n}`,
			[
				p[0] + i * FW - s / 2 + (i ? weg : -weg) * 0.6,
				p[1] - 0.12 - weg,
				p[2] + j * FH - s / 2 + (j ? weg : -weg) * 0.6
			],
			[s, s, s],
			'--ink',
			{ edge: null, flat: true }
		)
	);
}

const FENSTER_STATISCH = (() => {
	const k: Kiste[] = [
		kiste('grund', [-3, -4, -0.2], [32, 16, 0.2], '--paper-2', { edge: '--line' })
	];
	// Old building: facade with windows; the instance sits on the first upper floor in the middle.
	k.push(
		...altbau('alt', 0, 0, 8, 10, 3)
			.map((t) => t.k)
			.filter((x) => !x.id.startsWith('alt-fs-1-1'))
	);
	k.push(...regal('lager', 10.6, 1.4, 3, 1.2, 2, 2.2));
	// Tower: fixed frame (ink), changing infills; one bay waits for the window.
	const tx = 17,
		tw = 7,
		td = 7,
		n = 3,
		h = 3.2;
	for (const [px, py] of [
		[tx, 0],
		[tx + tw - 0.25, 0],
		[tx, td - 0.25],
		[tx + tw - 0.25, td - 0.25],
		[tx + 3.37, 0]
	])
		k.push(
			kiste(`turm-stuetze-${px}-${py}`, [px, py, 0], [0.25, 0.25, n * h + 0.3], '--ink', {
				edge: null
			})
		);
	for (let g = 0; g <= n; g++)
		k.push(kiste(`turm-decke-${g}`, [tx, 0, g * h], [tw, td, 0.25], '--paper', { edge: '--ink' }));
	const fuellung = (id: string, x: number, g: number, fill: string) =>
		k.push(
			kiste(`turm-${id}`, [x, 0.05, g * h + 0.25], [3.1, 0.12, h - 0.25], fill, {
				target: 'huelle'
			})
		);
	fuellung('a0', tx + 0.25, 0, MAT_HELL);
	fuellung('b0', tx + 3.62, 0, strom('people'));
	fuellung('b1', tx + 3.62, 1, stromStufe('people', 3));
	fuellung('a2', tx + 0.25, 2, strom('people'));
	fuellung('b2', tx + 3.62, 2, MAT_HELL);
	// Bay of the window: infill with an opening (top, bottom, sides).
	const ox = F_TURM[0],
		oz = F_TURM[2];
	k.push(
		kiste(
			'turm-feld-u',
			[tx + 0.25, 0.05, h + 0.25],
			[3.1, 0.12, oz - h - 0.25],
			stromStufe('people', 3),
			{ target: 'huelle' }
		)
	);
	k.push(
		kiste(
			'turm-feld-o',
			[tx + 0.25, 0.05, oz + FH],
			[3.1, 0.12, 2 * h - oz - FH],
			stromStufe('people', 3),
			{ target: 'huelle' }
		)
	);
	k.push(
		kiste(
			'turm-feld-l',
			[tx + 0.25, 0.05, oz],
			[ox - tx - 0.25, 0.12, FH],
			stromStufe('people', 3),
			{ target: 'huelle' }
		)
	);
	k.push(
		kiste(
			'turm-feld-r',
			[ox + FW, 0.05, oz],
			[tx + 3.35 - ox - FW, 0.12, FH],
			stromStufe('people', 3),
			{ target: 'huelle' }
		)
	);
	return k;
})();

export function fensterSzene(timeS: number, hover?: string): BauteilBild {
	const p = fortschritt('fenster');
	const [p1, p2, p3, p4] = ['pass', 'loesen', 'lager', 'einsetzen'].map((id) => p(timeS, id));
	let pos: Vec3 = F_ALT;
	if (p2 > 0) pos = lerp3(F_ALT, [F_ALT[0], -1.6, F_ALT[2]], window01(p2, 0.4, 1));
	if (p3 > 0) pos = flug([F_ALT[0], -1.6, F_ALT[2]], F_LAGER, window01(p3, 0, 0.7), 2.5);
	if (p4 > 0) pos = flug(F_LAGER, [F_TURM[0], -1.4, F_TURM[2]], window01(p4, 0, 0.6), 4);
	if (p4 > 0.6) pos = lerp3([F_TURM[0], -1.4, F_TURM[2]], F_TURM, window01(p4, 0.6, 0.8));
	const hervor = hover === 'exemplar' || (p1 > 0 && p1 < 0.35 && Math.floor(p1 * 12) % 2 === 0);
	const k: Kiste[] = [...FENSTER_STATISCH, ...fensterKisten(pos, hervor)];
	// Screws: loosen in phase 2, sit again at the end of phase 4.
	if (p2 < 1) k.push(...schrauben(F_ALT, window01(p2, 0, 0.45)));
	else if (p4 > 0.8) k.push(...schrauben(F_TURM, 1 - window01(p4, 0.8, 0.95)));
	// The opening becomes a door to the elevated walkway.
	const tuer = window01(p2, 0.6, 1);
	if (tuer > 0) {
		k.push(
			kiste('tuer', [F_ALT[0], -0.06, G + 0.1], [FW, 0.1, 2.5 * tuer], strom('people'), {
				target: 'tuer'
			})
		);
		k.push(
			kiste(
				'steg',
				[F_ALT[0] - 0.7, -2.6 * tuer, G - 0.2],
				[FW + 1.4, 2.6 * tuer, 0.3],
				strom('people'),
				{ target: 'tuer' }
			)
		);
	}
	return { kisten: k, exemplar: [pos[0] + FW / 2, pos[1], pos[2] + FH / 2] };
}

/* ── Slab ─────────────────────────────────────────────────────────────── */

const PL: Vec3 = [0.25, 0.15, 0.92];
const PL_S: Vec3 = [2.5, 1.25, 0.05];
const SCHNITT = 1.6;
const MODUL: Vec3 = [4.6, 0.2, 0];
const LAGER_P: Vec3 = [7.65, 0.2, 1.24];

const PLATTE_STATISCH = (() => {
	const k: Kiste[] = [
		kiste('grund', [-1.5, -2, -0.1], [13.5, 6, 0.1], '--paper-2', { edge: '--line' })
	];
	// Workbench
	k.push(
		kiste('bank-platte', [0, 0, 0.82], [3, 1.55, 0.1], '--paper', {
			edge: '--ink-2',
			target: 'werkbank'
		})
	);
	for (const [x, y] of [
		[0.1, 0.1],
		[2.8, 0.1],
		[0.1, 1.35],
		[2.8, 1.35]
	])
		k.push(kiste(`bank-bein-${x}-${y}`, [x, y, 0], [0.1, 0.1, 0.82], '--ink-2', { edge: null }));
	k.push(...regal('lager', 7.5, 0, 1.6, 1.4, 2, 1.12));
	// Module of the tower: frame in ink, waiting for its floor plate.
	const [mx, my] = MODUL;
	for (const [x, y] of [
		[mx, my],
		[mx + 1.72, my],
		[mx, my + 1.37],
		[mx + 1.72, my + 1.37]
	])
		k.push(kiste(`modul-pfosten-${x}-${y}`, [x, y, 0], [0.08, 0.08, 2.4], '--ink', { edge: null }));
	k.push(
		kiste('modul-dach', [mx, my, 2.4], [1.8, 1.45, 0.08], '--paper', {
			edge: '--ink',
			target: 'modul'
		})
	);
	k.push(
		kiste('modul-wand', [mx + 0.08, my + 1.37, 0.1], [1.64, 0.06, 2.3], strom('people'), {
			target: 'modul'
		})
	);
	return k;
})();

/** Five strips of the offcut: three shelves, two stringers. Target: the rack next to the depot. */
const REGAL_X = 9.9;
const STREIFEN: { liegt: Vec3; ziel: Vec3; zielS: Vec3 }[] = [0, 1, 2, 3, 4].map((i) => {
	const liegt: Vec3 = [LAGER_P[0] + 0.15, LAGER_P[1] + i * 0.25, LAGER_P[2]];
	if (i < 3)
		return { liegt, ziel: [REGAL_X + 0.05, 0.3, 0.08 + i * 0.42], zielS: [0.8, 0.25, 0.05] };
	return { liegt, ziel: [REGAL_X + (i === 3 ? 0 : 0.85), 0.3, 0], zielS: [0.05, 0.25, 0.9] };
});

export function platteSzene(timeS: number, hover?: string): BauteilBild {
	const p = fortschritt('platte');
	const [, p2, p3, p4] = ['platte', 'zuschnitt', 'rest', 'regal'].map((id) => p(timeS, id));
	const k: Kiste[] = [...PLATTE_STATISCH];
	const hervor = (t: string) => (hover === t ? '--signal' : '--ink');
	// The cut line grows across the slab.
	const linie = window01(p2, 0, 0.35) * (1 - window01(p2, 0.45, 0.5));
	if (linie > 0)
		k.push(
			kiste(
				'schnitt',
				[PL[0] + SCHNITT - 0.01, PL[1], PL[2] + PL_S[2]],
				[0.02, PL_S[1] * linie, 0.01],
				'--blueprint',
				{ edge: null, flat: true }
			)
		);
	const geteilt = p2 >= 0.45;
	if (!geteilt) {
		k.push(kiste('platte', PL, PL_S, MAT, { target: 'exemplar', edge: hervor('exemplar') }));
		return { kisten: k, exemplar: [PL[0] + PL_S[0] / 2, PL[1] + PL_S[1] / 2, PL[2]] };
	}
	// The panel flies into the module as a floor plate.
	const paneelZiel: Vec3 = [MODUL[0] + 0.1, MODUL[1] + 0.08, 0.02];
	const paneel = flug(PL, paneelZiel, window01(p2, 0.5, 1), 1.2);
	k.push(kiste('paneel', paneel, [SCHNITT, PL_S[1], PL_S[2]], MAT, { target: 'paneel' }));
	// Offcut: stays put, gets a passport (phase 3), goes to the depot, becomes a rack (phase 4).
	const restStart: Vec3 = [PL[0] + SCHNITT + 0.04, PL[1], PL[2]];
	const restS: Vec3 = [PL_S[0] - SCHNITT - 0.04, PL_S[1], PL_S[2]];
	let anker: Vec3;
	if (p4 <= 0.25) {
		const pos = flug(restStart, LAGER_P, window01(p3, 0.35, 0.9), 1);
		k.push(kiste('rest', pos, restS, MAT, { target: 'exemplar', edge: hervor('exemplar') }));
		// Cut lines of the cutting appear shortly before taking it apart.
		const marken = window01(p4, 0, 0.2);
		if (marken > 0)
			for (let i = 1; i < 5; i++)
				k.push(
					kiste(
						`marke-${i}`,
						[pos[0], pos[1] + i * 0.25 - 0.01, pos[2] + restS[2]],
						[restS[0] * marken, 0.02, 0.01],
						'--blueprint',
						{ edge: null, flat: true }
					)
				);
		anker = [pos[0] + restS[0] / 2, pos[1] + restS[1] / 2, pos[2]];
	} else {
		STREIFEN.forEach((s, i) => {
			const f = window01(p4, 0.25 + i * 0.08, 0.6 + i * 0.08);
			const a = flug(s.liegt, s.ziel, f, 0.8);
			const size = lerp3([0.8, 0.22, 0.05], s.zielS, smooth(f));
			k.push(
				kiste(`streifen-${i}`, a, size, MAT, { target: 'exemplar', edge: hervor('exemplar') })
			);
		});
		anker = [REGAL_X + 0.45, 0.4, 0.6];
	}
	return { kisten: k, exemplar: anker };
}

/* ── Pallet ───────────────────────────────────────────────────────────── */

const SITZ = 0.42;
const BEINE_LAGER: Vec3 = [1.5, -0.5, 0];

function palette(z: number, hervor: boolean): Kiste[] {
	const t = { target: 'exemplar', edge: hervor ? '--signal' : '--ink' };
	const out: Kiste[] = [];
	for (let i = 0; i < 3; i++)
		out.push(kiste(`pal-unten-${i}`, [0, i * 0.35, z], [1.2, 0.1, 0.022], MAT_HELL, t));
	for (let i = 0; i < 3; i++)
		for (let j = 0; j < 3; j++)
			out.push(
				kiste(`pal-klotz-${i}-${j}`, [i * 0.5275, j * 0.35, z + 0.022], [0.145, 0.1, 0.078], MAT, t)
			);
	for (let i = 0; i < 3; i++)
		out.push(kiste(`pal-quer-${i}`, [i * 0.5275, 0, z + 0.1], [0.145, 0.8, 0.022], MAT_HELL, t));
	for (let i = 0; i < 5; i++)
		out.push(
			kiste(
				`pal-deck-${i}`,
				[0, i * 0.175, z + 0.122],
				[1.2, 0.1, 0.022],
				i === 3 ? MAT : MAT_HELL,
				t
			)
		);
	return out;
}

/** Plug-in leg under a corner block: a tube with a collar that grips the block. */
function bein(id: string, p: Vec3): Kiste[] {
	return [
		kiste(`${id}-rohr`, [p[0] + 0.02, p[1] + 0.01, p[2]], [0.1, 0.08, SITZ], MAT_DUNKEL, {
			target: 'beine'
		}),
		kiste(
			`${id}-kragen`,
			[p[0] - 0.01, p[1] - 0.01, p[2] + SITZ - 0.02],
			[0.165, 0.12, 0.06],
			MAT_DUNKEL,
			{ target: 'beine' }
		)
	];
}

const ECKEN: [number, number][] = [
	[0, 0],
	[1.055, 0],
	[0, 0.7],
	[1.055, 0.7]
];

const PALETTE_STATISCH = (() => {
	const k: Kiste[] = [
		kiste('grund', [-2.4, -1.2, -0.05], [5.4, 3, 0.05], '--paper-2', { edge: '--line' })
	];
	// Courtyard: planter and tree as existing stock.
	k.push(kiste('kuebel', [2.1, 1.1, 0], [0.5, 0.5, 0.45], BESTAND.fill, { edge: BESTAND.edge }));
	k.push(kiste('kuebel-pflanze', [2.17, 1.17, 0.45], [0.36, 0.36, 0.5], strom('food'), {}));
	return k;
})();

export function paletteSzene(timeS: number, hover?: string): BauteilBild {
	const p = fortschritt('palette');
	const [, p2, p3, p4] = ['palette', 'beine', 'bank', 'zerlegen'].map((id) => p(timeS, id));
	const k: Kiste[] = [...PALETTE_STATISCH];
	// The pallet rises in phase 2 (the legs go underneath), lowers in phase 4 (the legs are gone).
	const hoch = window01(p2, 0, 0.35) * (1 - window01(p4, 0.5, 0.8));
	const z = SITZ * hoch;
	k.push(...palette(z, hover === 'exemplar'));
	ECKEN.forEach(([x, y], i) => {
		const lager: Vec3 = [BEINE_LAGER[0] + i * 0.22, BEINE_LAGER[1], 0];
		const pos =
			p4 > 0
				? flug([x, y, 0], lager, window01(p4, 0.15, 0.45), 0.5)
				: flug(lager, [x, y, 0], window01(p2, 0.35, 0.85), 0.6);
		k.push(...bein(`bein-${i}`, pos));
	});
	// Phase 3: someone sits down; leaves at the start of phase 4.
	const sitzt = window01(p3, 0.1, 0.4) * (1 - window01(p4, 0, 0.15));
	if (sitzt > 0)
		k.push(
			kiste('mensch', [0.4, 0.2 - (1 - sitzt) * 1.2, z + 0.144], [0.4, 0.4, 0.8], strom('people'), {
				edge: null,
				flat: true,
				target: 'mensch'
			}),
			kiste(
				'mensch-kopf',
				[0.49, 0.29 - (1 - sitzt) * 1.2, z + 0.98],
				[0.22, 0.22, 0.25],
				strom('people'),
				{ edge: null, flat: true, target: 'mensch' }
			)
		);
	return { kisten: k, exemplar: [0.6, 0.4, z + 0.144] };
}

export const bauteilRahmen: Record<BauteilLoopId, Rahmen> = {
	fenster: { target: [9.5, 3, 5.2], widthM: 33, heightM: 20, azimuthDeg: 22, elevationDeg: 22 },
	platte: { target: [4, 0.8, 1.2], widthM: 15, heightM: 8.4, azimuthDeg: 24, elevationDeg: 30 },
	palette: { target: [0.2, 0.4, 0.45], widthM: 5.6, heightM: 3.4, azimuthDeg: 28, elevationDeg: 30 }
};

export function bauteilSzene(id: BauteilLoopId, timeS: number, hover?: string): BauteilBild {
	if (id === 'fenster') return fensterSzene(timeS, hover);
	if (id === 'platte') return platteSzene(timeS, hover);
	return paletteSzene(timeS, hover);
}
