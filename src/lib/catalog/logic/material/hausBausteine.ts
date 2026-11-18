/** Building blocks for the reference houses in meters: x right, y depth (front = −y), z up. */
import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import type { FamilieId } from '../../data/materialSeite';
import type { StudienProfil, Teil, Vec3 } from './formen';
import { rezept, voreinstellung, type Strom } from './rezept';

/** Skin of a part: family, optional flow tint and studio finish. */
export type Haut = { familie: FamilieId; strom?: Strom; finish?: AusfuehrungId; anteil?: number };
export type HausZone = 'huelle' | 'akzent' | 'sockel' | 'kern';
export type HausTeil = Readonly<{ id: string; zone: HausZone; teil: Teil; haut?: Haut }>;

export const beton: Haut = { familie: 'beton', finish: 'beton-schalung' };
export const graphit: Haut = { familie: 'metall', finish: 'metall-graphit' };
const fase: StudienProfil = { art: 'fase', radius: 0.025 };

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
