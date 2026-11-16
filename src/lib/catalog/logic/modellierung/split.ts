/**
 * Teaching version "split grammar": a block is split recursively in (u, v).
 * Split ratios are continuous (they morph with t), the number of splits is discrete (an event).
 * IDs encode the path in the tree and stay the same through every movement.
 */
import { random } from '../parametrik/random';
import type { Punkt } from './netz';
import { bilinear } from './eck';

export type SplitOptionen = {
	saat: number;
	tiefe: number;
	t: number;
	/** Split only perpendicular to the frontage: every child keeps access. */
	zugangsregel: boolean;
	/** Minimum frontage in meters. */
	front?: number;
};
export type Blatt = {
	id: string;
	uv: [number, number, number, number];
	polygon: Punkt[];
	front: number;
	zugang: boolean;
};
export type Teilung = { blaetter: Blatt[]; block: [Punkt, Punkt, Punkt, Punkt]; linien: Punkt[][] };

/** Block in meters: a slightly skewed quad, different per seed. */
export function block(saat: number): [Punkt, Punkt, Punkt, Punkt] {
	const rng = random(saat ^ 0x51ed27);
	return [
		[0, 0],
		[64 + rng() * 10, rng() * 6],
		[70 + rng() * 8, 46 + rng() * 6],
		[rng() * 8, 42 + rng() * 6]
	];
}

/** Integer hash per node ID and channel: the ratio is independent of the evaluation order. */
function hash(saat: number, id: string, kanal: number) {
	let h = (saat ^ (kanal * 0x9e3779b1)) >>> 0;
	for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
	return random(h)();
}

export function teile(o: SplitOptionen): Teilung {
	const q = block(o.saat);
	const mindest = o.front ?? 6;
	const blaetter: Blatt[] = [];
	const linien: Punkt[][] = [];
	const p = (u: number, v: number) => bilinear(q, [u, v]);
	const laenge = (a: Punkt, b: Punkt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
	const rechteck = (r: [number, number, number, number]) => {
		const [u0, v0, u1, v1] = r;
		return [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
	};
	/** Longest edge of a sub-rectangle on the block edge (paths all around), in meters. */
	const frontVon = (r: [number, number, number, number]) => {
		const [u0, v0, u1, v1] = r;
		const e = rechteck(r);
		return Math.max(
			v0 <= 1e-9 ? laenge(e[0], e[1]) : 0,
			u1 >= 1 - 1e-9 ? laenge(e[1], e[2]) : 0,
			v1 >= 1 - 1e-9 ? laenge(e[2], e[3]) : 0,
			u0 <= 1e-9 ? laenge(e[3], e[0]) : 0
		);
	};
	const kinder = (r: [number, number, number, number], achse: 0 | 1, f: number) => {
		const [u0, v0, u1, v1] = r;
		const u = u0 + (u1 - u0) * f,
			v = v0 + (v1 - v0) * f;
		return achse === 0
			? ([
					[u0, v0, u, v1],
					[u, v0, u1, v1]
				] as const)
			: ([
					[u0, v0, u1, v],
					[u0, v, u1, v1]
				] as const);
	};
	const geh = (id: string, r: [number, number, number, number], stufe: number) => {
		const ecken = rechteck(r);
		const breite = (laenge(ecken[0], ecken[1]) + laenge(ecken[3], ecken[2])) / 2;
		const tiefe = (laenge(ecken[0], ecken[3]) + laenge(ecken[1], ecken[2])) / 2;
		const f = 0.3 + 0.4 * (hash(o.saat, id, 0) + (hash(o.saat, id, 1) - hash(o.saat, id, 0)) * o.t);
		// Without the rule: always split the longer side. With the access rule only if both children keep the minimum frontage.
		const gut = (achse: 0 | 1) =>
			!o.zugangsregel || kinder(r, achse, f).every((k) => frontVon([...k]) >= mindest);
		const lang: 0 | 1 = breite >= tiefe ? 0 : 1;
		const achse = gut(lang) ? lang : gut(lang === 0 ? 1 : 0) ? (lang === 0 ? 1 : 0) : -1;
		if (stufe < o.tiefe && achse !== -1) {
			const [a, b] = kinder(r, achse, f);
			const [u0, v0, u1, v1] = r;
			linien.push(achse === 0 ? [p(a[2], v0), p(a[2], v1)] : [p(u0, a[3]), p(u1, a[3])]);
			geh(`${id}0`, [...a], stufe + 1);
			geh(`${id}1`, [...b], stufe + 1);
			return;
		}
		const front = frontVon(r);
		blaetter.push({ id, uv: r, polygon: ecken, front, zugang: front >= mindest });
	};
	geh('r', [0, 0, 1, 1], 0);
	return { blaetter, block: q, linien };
}
