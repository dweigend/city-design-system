import { required } from '../../required';
import type { Lage } from './lage';
import type { Belegung } from './belegung';
/** Height classes: gallery and rooftop walkway. */
export const KLASSEN = [2, 4];
/** Highest path level. */
export const TOP = 5;

export type Ziel = { id: string; kandidaten: number[]; anker?: number };
type Survey = {
	vOf: (id: string) => number;
	nb: number[][];
	usable: (vertex: number, level: number) => boolean;
	lang: (a: number, b: number) => number;
	node: (vertex: number, level: number) => number;
};

/** Selects the central square, preferring the larger block on ties. */
export function centralSquare(r: Lage, b: Belegung) {
	return r.blocks
		.filter((x) => b.arten.get(x.id) === 'platz')
		.sort((x, y) => y.naehe - x.naehe || y.cells.length - x.cells.length)[0];
}

/** Surveys a start node and ordered destination candidates for either path graph. */
export function routeTargets(r: Lage, b: Belegung, survey: Survey) {
	const ziele = roofTargets(b, survey);
	const { start, ground } = groundTargets(r, b, survey);
	return { start, ziele: ziele.concat(ground) };
}

function roofTargets(b: Belegung, { vOf, nb, usable, node }: Survey) {
	const ziele: Ziel[] = [];
	for (const e of b.eingriffe) {
		if (e.art === 'hofhaus') continue;
		ziele.push(...targetsForIntervention(e, { vOf, nb, usable, node }));
	}
	return ziele;
}

function targetsForIntervention(
	e: Exclude<Belegung['eingriffe'][number], { art: 'hofhaus' }>,
	{ vOf, nb, usable, node }: Omit<Survey, 'lang'>
) {
	const ziele: Ziel[] = [];
	const stufen = e.art === 'aufstockung' ? [e.base] : KLASSEN.filter((l) => l <= e.top);
	for (const l of stufen) {
		const kern = e.kern ? nb[vOf(e.kern)].filter((v) => usable(v, l)).map((v) => node(v, l)) : [];
		const kandidaten = kern.length ? kern : neighborsOnLevel(e.cells, l, { vOf, nb, usable, node });
		if (kandidaten.length) ziele.push({ id: `${e.id}@${l}`, kandidaten });
	}
	return ziele;
}

function groundTargets(r: Lage, b: Belegung, { vOf, usable, lang, node }: Survey) {
	const ziele: Ziel[] = [];
	// Ground: square, platform, gardens and basins.
	const boden = (id: string, vs: number[]) => {
		const kandidaten = vs.filter((v) => usable(v, 0)).map((v) => node(v, 0));
		if (kandidaten.length) ziele.push({ id, kandidaten });
	};
	// The square is the free block closest to the center.
	const platz = centralSquare(r, b);
	const zur = (x: typeof platz, id: string) =>
		Math.hypot(
			required(r.point.get(id), 'r.point.get(id)')[0] - x.center[0],
			required(r.point.get(id), 'r.point.get(id)')[1] - x.center[1]
		);
	const mitte = (x: typeof platz) =>
		vOf([...x.cells].sort((p, q) => zur(x, p) - zur(x, q) || (p < q ? -1 : 1))[0]);
	const start = node(mitte(platz), 0);
	boden('bahnsteig', r.bahnsteig.map(vOf));
	for (const x of r.blocks) {
		const art = b.arten.get(x.id);
		if (art === 'garten') boden(`garten-${x.id}`, [mitte(x)]);
		// Basins: two spots on the waterfront, facing each other.
		if (art === 'wasser') {
			const ufer = x.cells.filter((id) => x.tiefe.get(id) === 1).sort(),
				gegen = [...ufer].sort(
					(p, q) => lang(vOf(q), vOf(ufer[0])) - lang(vOf(p), vOf(ufer[0])) || (p < q ? -1 : 1)
				)[0];
			if (ufer.length) boden(`becken-${x.id}`, [vOf(ufer[0]), vOf(gegen)]);
		}
	}
	return { start, ground: ziele };
}

/** Addresses the square and sorted destinations for the port graph. */
export function wegZiele(r: Lage, b: Belegung, usableId: (id: string, l: number) => boolean) {
	const ids = r.patch.vertices.map((v) => v.id),
		vOfId = new Map(ids.map((id, i) => [id, i])),
		vOf = (id: string) => required(vOfId.get(id), 'vOfId.get(id)'),
		L = TOP + 1;
	const nb = r.patch.vertices.map((v) => v.neighbors.map(vOf)),
		node = (v: number, l: number) => v * L + l,
		usable = (v: number, l: number) => usableId(ids[v], l);
	const lang = (a: number, b: number) =>
		Math.hypot(
			required(r.point.get(ids[a]), 'r.point.get(ids[a])')[0] -
				required(r.point.get(ids[b]), 'r.point.get(ids[b])')[0],
			required(r.point.get(ids[a]), 'r.point.get(ids[a])')[1] -
				required(r.point.get(ids[b]), 'r.point.get(ids[b])')[1]
		);
	const { start, ziele } = routeTargets(r, b, { vOf, nb, usable, lang, node });

	const pos = (k: number) =>
		required(r.point.get(ids[Math.floor(k / L)]), 'r.point.get(ids[Math.floor(k / L)])');
	const p = pos(start);
	const fern = (k: number) => Math.hypot(pos(k)[0] - p[0], pos(k)[1] - p[1]);
	return [
		{ id: 'platz', ports: [start] },
		...ziele
			.sort((a, b) => fern(a.kandidaten[0]) - fern(b.kandidaten[0]) || (a.id < b.id ? -1 : 1))
			.map((z) => ({ id: z.id, ports: z.kandidaten }))
	].map((z) => ({ id: z.id, ports: z.ports.map((k) => `${ids[Math.floor(k / L)]}@${k % L}`) }));
}

function neighborsOnLevel(
	cells: [string, number][],
	level: number,
	{ vOf, nb, usable, node }: Omit<Survey, 'lang'>
) {
	return [
		...new Set(
			cells
				.filter(([, l]) => l === level)
				.flatMap(([id]) => nb[vOf(id)])
				.filter((v) => usable(v, level))
				.map((v) => node(v, level))
		)
	];
}
