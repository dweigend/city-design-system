import type { Stueck, Vec3 } from './formen';
import {
	blockEntwurf,
	hausRezept,
	kistenEntwurf,
	type HausTeil,
	type HausZone,
	type Haut
} from './hausBausteine';
import { studienZufall } from './studienZufall';

export type { HausTeil, HausZone } from './hausBausteine';

const sockelHoeheM = 0.18;
const dachDickeM = 0.24;
/** Cornice band height; tall enough to carry the accent color at house scale. */
const CORNICE_M = 0.36;
/** Cornice top sits this far below the roof top, so the two faces never share a plane (no z-fighting). */
const CORNICE_ABSTAND_M = 0.03;

function geschoss(i: number, mass: Vec3, lage: Vec3, tuerLinks: number): HausTeil[] {
	const [w, d, h] = mass;
	const [x, y, z] = lage;
	const tuer = [tuerLinks, 0.24, 2 / (h - dachDickeM)] as const;
	const teile = kistenEntwurf(
		`g${i}`,
		mass,
		lage,
		[
			[0.14, 0.33, 0.28, 0.41],
			[0.6, 0.33, 0.24, 0.41]
		],
		[[0.17, 0.34, 0.54, 0.4]],
		i === 0 ? tuer : undefined,
		dachDickeM
	);
	if (i === 0)
		teile.push(
			blockEntwurf(
				'door',
				[w * tuer[1] - 0.04, 0.06, 1.98],
				[x + w * (tuerLinks + tuer[1] / 2 - 0.5), y - d / 2 + 0.22, z],
				'akzent'
			)
		);
	teile.push(
		blockEntwurf(
			`g${i}-cornice`,
			[w + 0.1, d + 0.1, CORNICE_M],
			[x, y, z + h - CORNICE_M - CORNICE_ABSTAND_M],
			'akzent'
		)
	);
	return teile;
}

/** Fresh house centered at the origin in meters, front at −y and z up. Counter slots
 * 0–6 choose storey count, width, depth, height, setback, setback side and door position.
 * The plinth comes first, followed by each storey from bottom to top. */
export function hausEntwurf(saat: number): HausTeil[] {
	const draw = (i: number) => studienZufall(saat, i);
	const count = 1 + Math.floor(3 * draw(0));
	const w = 3.8 + draw(1),
		d = 3.8 + draw(2),
		h = 2.4 + 0.8 * draw(3);
	const setback = 0.38 * draw(4),
		side = draw(5) < 0.5 ? -1 : 1;
	const tuerLinks = 0.12 + 0.52 * draw(6);
	const teile = [blockEntwurf('plinth', [w + 0.2, d + 0.2, sockelHoeheM], [0, 0, 0], 'sockel')];
	for (let i = 0; i < count; i++) {
		const inset = i * setback;
		teile.push(
			...geschoss(
				i,
				[w - inset, d - inset, h],
				[(side * inset) / 2, inset / 2, sockelHoeheM + i * h],
				tuerLinks
			)
		);
	}
	return teile;
}

/** Places three houses by default, left to right, centered on x at 6.4 m intervals.
 * House i uses seed saat + 5i. A nonnegative integer count yields fresh, prefixed parts. */
export function siedlungEntwurf(saat: number, anzahl = 3): HausTeil[] {
	return Array.from({ length: anzahl }, (_, i) =>
		hausEntwurf(saat + 5 * i).map(({ id, zone, teil }) => {
			teil.lage[0] += (i - (anzahl - 1) / 2) * 6.4;
			return { id: `h${i}-${id}`, zone, teil };
		})
	).flat();
}

/** Dresses each part in input order with detached geometry and a fresh zone recipe. */
export function bekleide(entwurf: readonly HausTeil[], zonen: Record<HausZone, Haut>): Stueck[] {
	return entwurf.map(({ id, zone, teil }) => {
		const haut = zonen[zone];
		return { id, teil: structuredClone(teil), rezept: hausRezept(haut), ausfuehrung: haut.finish };
	});
}
