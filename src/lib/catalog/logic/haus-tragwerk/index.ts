import type { FlowId } from '../../data/focus';
import { planen, type Vec3 } from '../traeger';
import { haengehaus, type Stufe } from './haengehaus';
import { FUGE_M } from './bestand';
import { wabe } from './anschluss/wabe';
import { kuppel } from './anschluss/kuppel';
import { faltwerk } from './anschluss/faltwerk';
import { pruefeEinbau, type Bauplan, type HausFamilie, type Ergebnis, anschlussVon } from './plan';
export * from './plan';
export type { Stufe } from './haengehaus';
export * from './bestand';
export { analysiere, type Analyse, type AnalyseArt, type AnalyseStrecke } from './analyse';
export {
	HAENGEHAUS_VERSION,
	belegungVon,
	eigengewichtN,
	hausParameter,
	nachrechnen,
	type HausParameter
} from './haengehaus';
/**
 * New structural instance, meters, seed uint32; family switch explicitly discards all infills.
 *
 * Raumfachwerk: the carrier form follows from the structural simulation (`haengehaus`); `stufe`
 * selects the full lattice, the sized lattice or the form after removal. Other families ignore it.
 * The seed decides gap, lattice division, chord height and house depth (`hausParameter`). The
 * returned `statik` is the sizing state; after infills change, `nachrechnen` checks the carrier.
 */
export function neuBauen(
	familie: HausFamilie,
	saat = 42,
	werte: Record<string, number> = {},
	stufe: Stufe = 'abtrag'
): Bauplan {
	const simuliert = familie === 'raumfachwerk' ? haengehaus(werte, saat, stufe) : undefined;
	const traeger = simuliert?.traeger ?? aufDerFuge(familie, saat, werte);
	const anschluesse = simuliert
		? [simuliert.anschluss]
		: { wabe, kuppel, faltwerk }
				[familie as Exclude<HausFamilie, 'raumfachwerk'>](traeger)
				.sort((a, b) => a.id.localeCompare(b.id));

	if (familie !== 'wabe') {
		for (const a of [...anschluesse]) {
			anschluesse.push({
				...a,
				id: `${a.elementId}/dach/anschluss`,
				elementId: `${a.elementId}/dach`,
				art: 'garten',
				traegt: `${a.elementId}/einbau`,
				polygon:
					familie === 'faltwerk'
						? [
								[-3, a.tuer.p[1] - 4],
								[3, a.tuer.p[1] - 4],
								[3, a.tuer.p[1] - 1],
								[-3, a.tuer.p[1] - 1]
							]
						: a.polygon,
				z: familie === 'faltwerk' ? 8 : a.z + a.hoeheM,
				hoeheM: 0.2
			});
		}
		anschluesse.sort((a, b) => a.id.localeCompare(b.id));
	}
	return {
		version: 1,
		saat: saat >>> 0,
		familie,
		traeger,
		anschluesse,
		einbauten: [],
		eingang: {
			id: `${familie}/eingang`,
			p: anschluesse.find((a) => a.art === 'raum' && a.z === 8)?.tuer.p ?? [0, 0, 8]
		},
		...(simuliert ? { bestand: simuliert.bestand } : {}),
		...(simuliert?.statik ? { statik: simuliert.statik } : {})
	};
}
/** Family carrier as generated, lifted onto the eight meter joint, without occupancy. */
function aufDerFuge(familie: HausFamilie, saat: number, werte: Record<string, number>) {
	const raw = planen(
		familie,
		{ ...(familie === 'wabe' ? { lagen: 3, stufen: 1 } : {}), ...werte, belegung: 0 },
		saat
	);
	return {
		...raw,
		belegung: {},
		knoten: raw.knoten.map((n) => ({ ...n, p: [n.p[0], n.p[1], n.p[2] + FUGE_M] as Vec3 }))
	};
}
/** Stable canonical candidate order, independent of incoming adapter enumeration. */
export function kandidaten(p: Bauplan) {
	return [...p.anschluesse].sort(
		(a, b) => Number(a.art === 'garten') - Number(b.art === 'garten') || a.id.localeCompare(b.id)
	);
}
/** Atomic insert. Rejection always returns the predecessor by reference; no RNG consumption. */
export function einsetzen(p: Bauplan, id: string, nutzung: FlowId): Ergebnis {
	const a = p.anschluesse.find((a) => a.id === id);
	if (!a) return { plan: p, fehler: 'anschluss-unpassend' };
	if (p.einbauten.some((e) => e.anschlussId === id)) return { plan: p, fehler: 'kollision' };
	const fehler = pruefeEinbau(p, a);
	if (fehler) return { plan: p, fehler };
	return {
		plan: {
			...p,
			einbauten: [...p.einbauten, { id: `${a.elementId}/einbau`, anschlussId: id, nutzung }].sort(
				(a, b) => a.id.localeCompare(b.id)
			)
		}
	};
}
/** Wabe alone has load-bearing infills; preserve dependent rooms and gardens. */
export function entfernen(p: Bauplan, id: string): Ergebnis {
	const e = p.einbauten.find((e) => e.id === id);
	if (!e) return { plan: p, fehler: 'anschluss-unpassend' };
	const a = anschlussVon(p, e.anschlussId);
	if (
		p.familie === 'wabe' &&
		p.einbauten.some((other) => {
			const b = anschlussVon(p, other.anschlussId);
			return (
				b.traegt === id ||
				(b.z === a.z + a.hoeheM &&
					b.polygon.every((v, i) => v.every((n, j) => n === a.polygon[i]?.[j])))
			);
		})
	)
		return { plan: p, fehler: 'abhaengig' };
	return {
		plan: {
			...p,
			einbauten: p.einbauten.filter(
				(e) => e.id !== id && (p.familie === 'wabe' || anschlussVon(p, e.anschlussId).traegt !== id)
			)
		}
	};
}
/** Usage owns no geometry. Unaffected infills and the carrier preserve reference identity. */
export function nutzungSetzen(p: Bauplan, id: string, nutzung: FlowId): Ergebnis {
	if (!p.einbauten.some((e) => e.id === id)) return { plan: p, fehler: 'anschluss-unpassend' };
	return {
		plan: { ...p, einbauten: p.einbauten.map((e) => (e.id === id ? { ...e, nutzung } : e)) }
	};
}
/** Read-only derived occupancy, existing fixture format stays untouched. */
export function hausBelegung(p: Bauplan) {
	if (p.familie !== 'wabe') return {};
	return Object.fromEntries(
		p.einbauten.map((e) => [anschlussVon(p, e.anschlussId).elementId, e.nutzung])
	);
}

/** Five existing teaching phases: stock, frame, insert, remove, new usage. No time or RNG. */
export function umbauBei(p: Bauplan, phase: number): Bauplan {
	if (phase === 2) return p;
	if (phase === 4) {
		let next = p;
		for (const e of p.einbauten)
			if (anschlussVon(p, e.anschlussId).art === 'raum')
				next = nutzungSetzen(next, e.id, 'material').plan;
		return next;
	}
	let next = p;
	for (const e of [...p.einbauten].reverse()) next = entfernen(next, e.id).plan;
	return next;
}
