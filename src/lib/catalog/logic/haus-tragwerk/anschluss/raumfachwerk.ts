import type { Vec3 } from '../../traeger/plan';
import type { Bestand } from '../bestand';
import { FUGE_M } from '../bestand';
import { anschluss, type Anschluss } from '../plan';

/** Assembly joint between the capsule end and the party wall, meters. */
const WANDFUGE_M = 0.55;
/** Half width and height of the tube capsule, meters: 2.6 m clear body, one story. */
const HALBE_BREITE_M = 1.3;
const HOEHE_M = 2.8;
/** Segments of each round end. */
const BOGEN_TEILE = 16;

/**
 * Tube capsule in the gap between two houses, floor on the eight meter joint. Its length follows
 * the gap, its axis lies midway between the two chord rows it hangs from (`reihenY`, the pair
 * nearest the plot center). `elementId` names the carrier node that identifies the room.
 */
export function kapsel(bestand: Bestand, reihenY: number[], elementId: string): Anschluss {
	const [links, rechts] = bestand.koerper;
	const x0 = links.x + links.breiteM,
		x1 = rechts.x;
	const mitteY = links.y + links.tiefeM / 2;
	const paare = [...reihenY]
		.sort((a, b) => a - b)
		.slice(1)
		.map((y, i, rest) => (y + (i ? rest[i - 1] : Math.min(...reihenY))) / 2);
	const y = paare.sort((a, b) => Math.abs(a - mitteY) - Math.abs(b - mitteY) || a - b)[0] ?? mitteY;
	const x = (x0 + x1) / 2,
		halbeLaenge = (x1 - x0) / 2 - WANDFUGE_M,
		gerade = Math.max(0, halbeLaenge - HALBE_BREITE_M);
	const bogen = (seite: 1 | -1) =>
		Array.from({ length: BOGEN_TEILE + 1 }, (_, i): [number, number] => {
			const winkel = (seite > 0 ? -Math.PI / 2 : Math.PI / 2) + (i * Math.PI) / BOGEN_TEILE;
			return [
				x + seite * gerade + HALBE_BREITE_M * Math.cos(winkel),
				y + HALBE_BREITE_M * Math.sin(winkel)
			];
		});
	const a = anschluss(elementId, 'eingehaengt', [...bogen(1), ...bogen(-1)], FUGE_M, HOEHE_M);
	// The door faces the left house; the walkway arrives over its roof.
	a.tuer.p = [x - halbeLaenge, y, FUGE_M];
	a.tuer.tangente = [0, -1];
	return a;
}

/** Straight part of the capsule in plan: center line and half extents, meters. */
export function kapselAchse(a: Anschluss): {
	mitte: Vec3;
	halbeGeradeM: number;
	halbeBreiteM: number;
} {
	const xs = a.polygon.map((p) => p[0]),
		ys = a.polygon.map((p) => p[1]);
	const halbeBreiteM = (Math.max(...ys) - Math.min(...ys)) / 2;
	return {
		mitte: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, a.z],
		halbeGeradeM: Math.max(0, (Math.max(...xs) - Math.min(...xs)) / 2 - halbeBreiteM),
		halbeBreiteM
	};
}
