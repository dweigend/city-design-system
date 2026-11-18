import { spanEnd, WALKWAY_WIDTH_M } from '../walkway';
import type { HochwegBeispiel } from '../../data/stadtHochwege';
import { wegenetz, type Kante, type Knoten } from '../bibel/wege';
import { beam, GRUND, kiste, stromStufe, type Kiste } from './kiste';
import { clamp01, cycle } from './zeitleiste';
import { altbau } from './bauten';

/** The path lies just above its level, so that it visibly rests on roofs of the same height. */
const WEG_UEBER = 0.3;

export type HochwegKante = Kante & {
	target: string;
	schleife: boolean;
	/** Visible length share, 0–1. */
	anteil: number;
};

/** 0.8 s per edge, then hold the complete network for 1.6 s. */
export function hochwegSchritt(timeS: number, anzahl: number): number {
	return Math.min(anzahl, (cycle(timeS, anzahl * 0.8 + 1.6) * (anzahl * 0.8 + 1.6)) / 0.8);
}

/**
 * Detached scene image; inputs stay unchanged. The step counts tree edges first,
 * then loops; fractional steps grow linearly. Dimensions in meters, heights 4 m per level.
 * Separate levels stay separate components; ports lead only from the ground to their own level.
 */
export function hochwegSzene(
	beispiel: HochwegBeispiel,
	schritt: number,
	schleifen = 2,
	hover?: string
): { kisten: Kiste[]; kanten: HochwegKante[] } {
	const netz = wegenetz(beispiel.knoten, schleifen);
	const kanten = [...netz.baum, ...netz.schleifen].map((e, i) => ({
		...e,
		target: `kante:${beispiel.knoten[e.a].id}-${beispiel.knoten[e.b].id}`,
		schleife: i >= netz.baum.length,
		anteil: clamp01(schritt - i)
	}));
	const xs = beispiel.knoten.map((n) => n.x);
	const ys = beispiel.knoten.map((n) => n.y);
	const minX = Math.min(...xs) - 6,
		minY = Math.min(...ys) - 6;
	const kisten: Kiste[] = [
		kiste(
			'grund',
			[minX, minY, -0.4],
			[Math.max(...xs) - minX + 6, Math.max(...ys) - minY + 6, 0.4],
			GRUND.fill,
			GRUND
		)
	];
	const zugang = zugaenge(beispiel.knoten.length, kanten);
	for (const [i, n] of beispiel.knoten.entries()) {
		const haus = beispiel.haeuser[i];
		const target = `knoten:${n.id}`;
		const aktiv = hover === target;
		const ecke: [number, number] = [n.x - haus.breite / 2, n.y - haus.tiefe / 2];
		if (haus.bestand)
			// Existing stock as an old building with a punched facade as in all city components; the volume keeps its ID.
			kisten.push(
				...altbau(`haus:${n.id}`, ecke[0], ecke[1], haus.breite, haus.tiefe, haus.geschosse, {
					target
				}).map(({ k }) => (aktiv && k.edge ? { ...k, edge: '--signal' } : k))
			);
		else
			kisten.push(
				// New towers pale in the color of people, so that the paths in front stay legible.
				kiste(
					`haus:${n.id}`,
					[ecke[0], ecke[1], 0],
					[haus.breite, haus.tiefe, haus.geschosse * 4],
					stromStufe('people', 2),
					{
						edge: aktiv ? '--signal' : '--ink-2',
						target
					}
				)
			);
		// Access from the ground at the ends of the network, at least one per subnetwork; isolated nodes none.
		if (zugang.has(i))
			kisten.push(
				kiste(
					`port:${n.id}`,
					[n.x + haus.breite / 2, n.y - 0.7, 0],
					[1.4, 1.4, n.ebene * 4 + WEG_UEBER],
					stromStufe('people', 3),
					{ edge: aktiv ? '--ink' : '--ink-2', target }
				)
			);
	}
	kisten.push(
		...kanten.filter((e) => e.anteil > 0).map((e) => wegKiste(e, beispiel.knoten, hover))
	);
	return { kisten, kanten };
}

function wegKiste(e: HochwegKante, knoten: Knoten[], hover?: string): Kiste {
	const a = knoten[e.a],
		b = knoten[e.b];
	const aktiv = hover === e.target || hover === `knoten:${a.id}` || hover === `knoten:${b.id}`;
	return beam(
		e.target,
		[a.x, a.y],
		spanEnd([a.x, a.y], [b.x, b.y], e.anteil),
		a.ebene * 4 + WEG_UEBER,
		WALKWAY_WIDTH_M,
		0.4,
		stromStufe('people', aktiv ? 5 : 4),
		{ edge: aktiv ? '--signal' : '--ink', target: e.target }
	);
}

/** Nodes with ground access: all ends (degree 1); a subnetwork without an end (ring) gets its first node. */
function zugaenge(n: number, kanten: Kante[]): Set<number> {
	const grad = Array<number>(n).fill(0);
	const eltern = Array.from({ length: n }, (_, i) => i);
	const wurzel = (i: number): number => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
	for (const e of kanten) {
		grad[e.a]++;
		grad[e.b]++;
		eltern[wurzel(e.a)] = wurzel(e.b);
	}
	const out = new Set<number>();
	const versorgt = new Set<number>();
	for (let i = 0; i < n; i++)
		if (grad[i] === 1) {
			out.add(i);
			versorgt.add(wurzel(i));
		}
	for (let i = 0; i < n; i++)
		if (grad[i] > 0 && !versorgt.has(wurzel(i))) {
			out.add(i);
			versorgt.add(wurzel(i));
		}
	return out;
}
