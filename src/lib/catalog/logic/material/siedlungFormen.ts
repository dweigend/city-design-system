import { planen } from '../traeger';
import type { Vec3 } from './formen';
import { blockEntwurf, type HausTeil, type HausZone, type Haut } from './hausBausteine';
import { tragwerkEntwurf } from './siedlungTragwerk';
import { studienZufall } from './studienZufall';

const holz: Haut = { familie: 'holz', finish: 'holz-natur' };
const glas: Haut = { familie: 'glas', finish: 'glas-klar' };
const mineral: Haut = { familie: 'beton', finish: 'beton-terrazzo' };
const lack: Haut = { familie: 'metall', finish: 'metall-signalrot' };
const naht: Haut = { familie: 'metall', finish: 'metall-gebuerstet' };
const kupfer: Haut = { familie: 'metall', finish: 'metall-kupfer' };
const sockelM = 0.24;

function rund(id: string, r: number, h: number, lage: Vec3, zone: HausZone): HausTeil {
	return { id, zone, teil: { art: 'zylinder', mass: [r, r, h], lage, rolle: 'neu' } };
}

function blendfeld(id: string, mass: Vec3, lage: Vec3): HausTeil {
	return { ...blockEntwurf(id, mass, lage, 'kern'), haut: glas };
}

function kuppel(saat: number): HausTeil[] {
	const r = 2.16 + 0.18 * studienZufall(saat, 0);
	const h = 2.25 + 0.58 * studienZufall(saat, 1);
	const haut = studienZufall(saat, 2) < 0.28 ? 1 : 0;
	const plan = planen('kuppel', { frequenz: 2, haut }, saat);
	return [
		rund('plinth', r + 0.23, sockelM, [0, 0, 0], 'sockel'),
		{ ...rund('stone-drum', r + 0.02, 0.23, [0, 0, sockelM], 'sockel'), haut: mineral },
		...tragwerkEntwurf(
			'dome',
			plan,
			[2 * r, 2 * r, h],
			[0, 0, 0.41],
			(f, i) => f.rolle === 'glas' && (i + saat) % 5 < 2
		),
		{ ...blockEntwurf('dome-core', [1.5, 1.42, 1.3], [0.28, 0.28, 0.47], 'kern'), haut: holz },
		...kuppelEingang()
	];
}

function kuppelEingang(): HausTeil[] {
	const x = -0.59;
	const y = -1.9;
	return [
		blockEntwurf('dome-entry', [1.32, 0.76, 0.22], [x, y, sockelM], 'akzent'),
		...[-0.45, 0.45].map((dx, i) => ({
			...blockEntwurf(`dome-jamb-${i}`, [0.12, 0.38, 1.02], [x + dx, y, 0.46], 'kern'),
			haut: lack
		})),
		{ ...blockEntwurf('dome-lintel', [1.02, 0.38, 0.13], [x, y, 1.48], 'kern'), haut: lack },
		blendfeld('dome-door', [0.76, 0.09, 1.02], [x, y + 0.11, 0.46])
	];
}

function turm(saat: number): HausTeil[] {
	const w = 4.1 + 0.45 * studienZufall(saat, 0);
	const d = 3.95 + 0.45 * studienZufall(saat, 1);
	const h = 2.35 + 0.65 * studienZufall(saat, 2);
	const offset = 0.44 * (studienZufall(saat, 3) - 0.5);
	const mass: Vec3 = [w, d, h];
	const lage: Vec3 = [offset, 0.05, 2.73];
	return [
		blockEntwurf('plinth', [4.8, 4.6, sockelM], [0, 0, 0], 'sockel'),
		{
			...blockEntwurf('tower-core', [1.9, 2.42, 2.5], [-0.55, 0.13, sockelM], 'kern'),
			haut: mineral
		},
		blendfeld('tower-window-front', [1.5, 0.095, 1.8], [0.87, -1.36, sockelM]),
		blendfeld('tower-window-side', [0.095, 2.64, 1.8], [1.64, 0, sockelM]),
		...galerieRahmen(),
		...galerieTreppe(),
		{ ...blockEntwurf('tower-deck', [4.04, 4.02, 0.2], [-0.15, 0, 2.04], 'sockel'), haut: holz },
		rund('tower-collar', 1.61, 0.54, [offset, 0.05, 2.24], 'akzent'),
		blockEntwurf('tower-skin', mass, lage, 'huelle', { art: 'kissen', form: 'kreuz' }),
		{
			...blockEntwurf('tower-seams', mass, lage, 'kern', { art: 'naht', form: 'kreuz' }),
			haut: naht
		}
	];
}

function galerieTreppe(): HausTeil[] {
	return Array.from({ length: 7 }, (_, i) => ({
		...blockEntwurf(
			`tower-step-${i}`,
			[0.54, 0.3, (i + 1) * 0.257],
			[2.13, -1.91 + i * 0.3, sockelM],
			'sockel'
		),
		haut: holz
	}));
}

function galerieRahmen(): HausTeil[] {
	const pfosten = [
		[0.11, -1.35],
		[0.88, -1.35],
		[1.65, -1.35],
		[1.65, 0],
		[1.65, 1.35]
	] as const;
	return [
		...pfosten.map(([x, y], i) =>
			blockEntwurf(`tower-post-${i}`, [0.085, 0.085, 1.8], [x, y, sockelM], 'kern')
		),
		blockEntwurf('tower-door', [0.91, 0.13, 1.66], [-0.58, -1.11, sockelM], 'akzent')
	];
}

function schale(saat: number): HausTeil[] {
	const w = 4.77 + 0.28 * studienZufall(saat, 0);
	const d = 4.25 + 0.52 * studienZufall(saat, 1);
	const h = 2.62 + 0.56 * studienZufall(saat, 2);
	const durchhang = 0.25 + 0.24 * studienZufall(saat, 3);
	const grundriss = studienZufall(saat, 4) > 0.66 ? 2 : 1;
	const plan = planen('gitterschale', { grundriss, maschen: 8, durchhang }, saat);
	return [
		blockEntwurf('plinth', [w + 0.13, d + 0.23, sockelM], [0, 0, 0], 'sockel'),
		{ ...blockEntwurf('shell-deck', [w, d, 0.14], [0, 0, sockelM], 'sockel'), haut: holz },
		...tragwerkEntwurf('shell', plan, [w, d, h], [0, 0, 0.32], (_, i) => i % 8 === 4),
		{
			...blockEntwurf('shell-pier', [0.81, 1.73, 1.42], [-0.35, 0.28, 0.38], 'kern'),
			haut: mineral
		},
		blockEntwurf('shell-entrance', [1.76, 0.58, 0.09], [0.04, -1.64, 0.38], 'akzent'),
		blendfeld('shell-window', [0.96, 0.085, 1.4], [0.55, -0.56, 0.38]),
		{
			...blockEntwurf('shell-screen', [1.11, 0.076, 1.23], [0.57, 0.87, 0.38], 'kern', {
				art: 'lochplatte'
			}),
			haut: kupfer
		}
	];
}

/** The settlement repeats its three construction types in order. The seed varies their
 * dimensions and glazing while the frames, uses and palette retain their roles. */
export const siedlungsFormen = [kuppel, turm, schale] as const;
