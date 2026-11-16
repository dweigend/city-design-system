import { required } from '../../required';
import type { Lage } from './lage';
import type { Belegung } from './belegung';
import { KLASSEN, TOP } from './wege';
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
	const ziele: { id: string; kandidaten: number[] }[] = [];
	const neben = (cells: [string, number][], level: number) => [
		...new Set(
			cells
				.filter(([, l]) => l === level)
				.flatMap(([id]) => nb[vOf(id)])
				.filter((v) => usable(v, level))
				.map((v) => node(v, level))
		)
	];
	for (const e of b.eingriffe) {
		if (e.art === 'hofhaus') continue;
		const stufen = e.art === 'aufstockung' ? [e.base] : KLASSEN.filter((l) => l <= e.top);
		for (const l of stufen) {
			const kern = e.kern ? nb[vOf(e.kern)].filter((v) => usable(v, l)).map((v) => node(v, l)) : [];
			const kandidaten = kern.length ? kern : neben(e.cells, l);
			if (kandidaten.length) ziele.push({ id: `${e.id}@${l}`, kandidaten });
		}
	}
	// Ground: square, platform, gardens and basins.
	const boden = (id: string, vs: number[]) => {
		const kandidaten = vs.filter((v) => usable(v, 0)).map((v) => node(v, 0));
		if (kandidaten.length) ziele.push({ id, kandidaten });
	};
	// The square is the free block closest to the center.
	const platz = [...r.blocks]
		.filter((x) => b.arten.get(x.id) === 'platz')
		.sort((x, y) => y.naehe - x.naehe || y.cells.length - x.cells.length)[0];
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
