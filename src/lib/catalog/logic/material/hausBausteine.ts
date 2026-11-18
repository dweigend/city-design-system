/** Building blocks for the reference houses in meters: x right, y depth (front = −y), z up. */
import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import type { FamilieId } from '../../data/materialSeite';
import type { StudienProfil, Teil, Vec3 } from './formen';
import { rezept, voreinstellung, type Strom } from './rezept';

/** Skin of a part: family, optional flow tint and studio finish. */
export type Haut = { familie: FamilieId; strom?: Strom; finish?: AusfuehrungId; anteil?: number };
export type HausZone = 'huelle' | 'akzent' | 'sockel' | 'kern';
export type HausTeil = Readonly<{ id: string; zone: HausZone; teil: Teil }>;
/** Window as left and bottom offsets, width and height in fractions of the wall. */
export type Fenster = readonly [number, number, number, number];

export const beton: Haut = { familie: 'beton', finish: 'beton-schalung' };
export const graphit: Haut = { familie: 'metall', finish: 'metall-graphit' };
const fase: StudienProfil = { art: 'fase', radius: 0.025 };
/** Nearly sharp edges for wall pieces that meet flush, so joints do not read as grooves. */
const scharf: StudienProfil = { art: 'fase', radius: 0.004 };

/** House recipe without drawn outlines: form reads through light, real seams and reveals only. */
export function hausRezept({ familie, strom = 'neutral', anteil }: Haut) {
	const r = rezept(familie, { ...voreinstellung(familie, strom), kante: 'keine' });
	if (anteil !== undefined) r.farbe.anteil = anteil;
	return r;
}

/** Builds a zoned box in meters, with its origin at the footprint center and base elevation. */
export function blockEntwurf(
	id: string,
	mass: Vec3,
	lage: Vec3,
	zone: HausZone,
	profil: StudienProfil = fase
): HausTeil {
	return { id, zone, teil: { art: 'quader', mass, lage, rolle: 'neu', profil: { ...profil } } };
}

/** Wall thickness of hollow volumes; deep enough to read as a reveal. */
const WAND = 0.3;

/**
 * A hollow volume whose front (−y) and right (+x) walls carry punched openings, or a front door
 * notch instead of front windows. A dark core sits behind the openings so they read as plain holes
 * without frames. Six parts (eight with a door), stable order.
 */
export function kistenEntwurf(
	id: string,
	[w, d, h]: Vec3,
	[x, y, z]: Vec3,
	vorn: readonly Fenster[],
	seite: readonly Fenster[],
	tuer?: readonly [number, number, number],
	dach = 0.24
): HausTeil[] {
	const wh = h - dach;
	const vornLage: Vec3 = [x, y - d / 2 + WAND / 2, z];
	const front = tuer
		? tuerwand(`${id}-front`, [w, WAND, wh], vornLage, tuer)
		: [
				blockEntwurf(`${id}-front`, [w, WAND, wh], vornLage, 'huelle', {
					art: 'fassade',
					fenster: vorn
				})
			];
	return [
		blockEntwurf(`${id}-core`, [w - 2 * WAND - 0.12, d - 2 * WAND - 0.12, wh], [x, y, z], 'kern'),
		...front,
		blockEntwurf(`${id}-right`, [WAND, d - 2 * WAND, wh], [x + w / 2 - WAND / 2, y, z], 'huelle', {
			art: 'fassade',
			quer: true,
			fenster: seite
		}),
		blockEntwurf(`${id}-back`, [w, WAND, wh], [x, y + d / 2 - WAND / 2, z], 'huelle', scharf),
		blockEntwurf(
			`${id}-left`,
			[WAND, d - 2 * WAND, wh],
			[x - w / 2 + WAND / 2, y, z],
			'huelle',
			scharf
		),
		blockEntwurf(`${id}-roof`, [w, d, dach], [x, y, z + wh], 'huelle', scharf)
	];
}

/**
 * Front wall with a full-height door notch, built as two piers and a lintel so the opening
 * reaches the ground. `tuer` gives left offset, width and height as fractions of the wall.
 */
function tuerwand(
	id: string,
	[w, t, h]: Vec3,
	[x, y, z]: Vec3,
	[links, breit, hoch]: readonly [number, number, number]
): HausTeil[] {
	const l = w * links,
		b = w * breit,
		r = w - l - b;
	return [
		blockEntwurf(`${id}-pier-left`, [l, t, h], [x - w / 2 + l / 2, y, z], 'huelle', scharf),
		blockEntwurf(`${id}-pier-right`, [r, t, h], [x + w / 2 - r / 2, y, z], 'huelle', scharf),
		blockEntwurf(
			`${id}-lintel`,
			[b, t, h * (1 - hoch)],
			[x - w / 2 + l + b / 2, y, z + h * hoch],
			'huelle',
			scharf
		)
	];
}
