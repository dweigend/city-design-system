/**
 * Existing houses as an input of the design: bodies up to the eight meter joint and the crowns of
 * their walls. A carrier may only bear where a wall is. Meters, world frame, headless.
 */
import type { Vec3 } from '../traeger/plan';

/** Height of the joint between old and new: eaves of the stock, bearings, walkway, front door. */
export const FUGE_M = 8;
/** A bearing sits at most this far beside a wall axis in plan (half a wall plus a shoe). */
export const AUFLAGER_TOLERANZ_M = 0.3;

export type Altbau = { id: string; x: number; y: number; breiteM: number; tiefeM: number };
export type Bestand = {
	koerper: Altbau[];
	/** Wall crowns at `FUGE_M`: the only lines a bearing may sit on. */
	wandachsen: [Vec3, Vec3][];
};

/** Outer walls of every body as crown lines, in body order, counter-clockwise from (x, y). */
export function bestandAus(koerper: Altbau[]): Bestand {
	const wandachsen: [Vec3, Vec3][] = [];
	for (const k of koerper) {
		const ecken: Vec3[] = [
			[k.x, k.y, FUGE_M],
			[k.x + k.breiteM, k.y, FUGE_M],
			[k.x + k.breiteM, k.y + k.tiefeM, FUGE_M],
			[k.x, k.y + k.tiefeM, FUGE_M]
		];
		ecken.forEach((a, i) => wandachsen.push([a, ecken[(i + 1) % 4]]));
	}
	return { koerper, wandachsen };
}

/**
 * Two houses at the ends of a plot with a gap between them. `x`, `y` is the plot corner; the
 * houses take the full depth and `hausBreiteM` each.
 */
export function lueckenBestand(
	x: number,
	y: number,
	breiteM: number,
	tiefeM: number,
	hausBreiteM: number
): Bestand {
	return bestandAus([
		{ id: 'links', x, y, breiteM: hausBreiteM, tiefeM },
		{ id: 'rechts', x: x + breiteM - hausBreiteM, y, breiteM: hausBreiteM, tiefeM }
	]);
}

/** Plan distance from a point to the nearest wall axis, meters. */
export function abstandZurWand(p: Vec3, bestand: Bestand): number {
	return Math.min(
		...bestand.wandachsen.map(([a, b]) => {
			const dx = b[0] - a[0],
				dy = b[1] - a[1];
			const t = Math.max(
				0,
				Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))
			);
			return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
		})
	);
}

/** The body whose footprint, widened by the bearing tolerance, contains the point. */
export function koerperUnter(p: Vec3, bestand: Bestand): Altbau | undefined {
	const t = AUFLAGER_TOLERANZ_M;
	return bestand.koerper.find(
		(k) =>
			p[0] >= k.x - t &&
			p[0] <= k.x + k.breiteM + t &&
			p[1] >= k.y - t &&
			p[1] <= k.y + k.tiefeM + t
	);
}
