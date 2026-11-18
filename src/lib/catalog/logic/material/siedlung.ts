import type { Stueck, Vec3 } from './formen';
import { hausRezept, type HausTeil, type HausZone, type Haut } from './hausBausteine';
import { siedlungsFormen } from './siedlungFormen';

export type { HausTeil, HausZone } from './hausBausteine';

/** Places three houses by default, centered on x at 6.4 m intervals and set back by 0.8 m
 * per slot. House i uses seed saat + 5i. A nonnegative integer count yields fresh parts. */
export function siedlungEntwurf(saat: number, anzahl = 3): HausTeil[] {
	return Array.from({ length: anzahl }, (_, i) =>
		siedlungsFormen[i % siedlungsFormen.length](saat + 5 * i).map(({ id, teil, ...part }) => {
			const [x, y, z] = teil.lage;
			const slot = i - (anzahl - 1) / 2;
			const lage: Vec3 = [x + slot * 6.4, y + slot * 0.8, z];
			return { ...part, id: `h${i}-${id}`, teil: { ...teil, lage } };
		})
	).flat();
}

/** Dresses each part in input order with detached geometry; a fixed finish takes precedence
 * over the zone palette. The picked envelope and colored trim remain separate parts. */
export function bekleide(entwurf: readonly HausTeil[], zonen: Record<HausZone, Haut>): Stueck[] {
	return entwurf.map(({ id, zone, teil, haut = zonen[zone] }) => {
		return { id, teil: structuredClone(teil), rezept: hausRezept(haut), ausfuehrung: haut.finish };
	});
}
