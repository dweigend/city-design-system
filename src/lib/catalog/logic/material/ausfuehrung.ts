import {
	materialAusfuehrungen,
	type Ausfuehrung,
	type AusfuehrungId
} from '../../data/materialAusfuehrung';
import type { FamilieId } from '../../data/materialSeite';
import { rezept, voreinstellung, type Rezept } from './rezept';

/** Returns detached finish records for a valid family, native first, without mutation or I/O. */
export function ausfuehrungenVon(fam: FamilieId): Ausfuehrung[] {
	return materialAusfuehrungen.filter((a) => a.familie === fam).map((a) => ({ ...a }));
}

/** Physical studio values; pigment shares and response coefficients are dimensionless 0–1. */
export type OberflaechenWerte = Omit<Ausfuehrung, 'deckkraft'> & { deckkraft: number };

/**
 * Resolves a detached studio finish from a legacy recipe without changing it. Missing or foreign
 * finish IDs select the family's first finish. Controls are offsets from legacy native response;
 * named opaque finishes fix coverage. Glass, water and stock ignore pigment. No randomness, I/O,
 * errors or geometry changes.
 */
export function oberflaechenWerte(r: Rezept, id?: AusfuehrungId): OberflaechenWerte {
	const finishes = ausfuehrungenVon(r.familie);
	const finish = finishes.find((a) => a.id === id) ?? finishes[0];
	const native = rezept(r.familie, voreinstellung(r.familie, 'neutral'));
	const roughnessDelta =
		(Math.sqrt(r.haut.glanzbreite) - Math.sqrt(native.haut.glanzbreite)) * 0.75;
	const glossDelta =
		(r.haut.glanz - native.haut.glanz) * -0.3 + (r.haut.sheen - native.haut.sheen) * -0.12;
	const transmission =
		finish.transmission *
		Math.min(1, (1 - r.haut.deckkraft) / Math.max(0.01, 1 - native.haut.deckkraft));
	return {
		...finish,
		pigment: r.farbe.token === '--paper' ? 0 : (r.farbe.anteil ?? finish.pigment),
		rauheit: Math.max(0.025, Math.min(0.99, finish.rauheit + roughnessDelta + glossDelta)),
		transmission,
		deckkraft: finish.deckkraft ?? (finish.transmission > 0 ? 1 : r.haut.deckkraft)
	};
}
