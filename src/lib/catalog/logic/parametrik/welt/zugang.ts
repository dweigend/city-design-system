import { required } from '../../required';
import { cellOutline, grenze } from '../eckraster/bestand';
import { address, BESTAND, WEG } from '../eckraster/state';
import { frontage, type Front } from '../raster/universal/kern';
import type { Lage } from './lage';
import type { Belegung, Eingriff } from './belegung';
export const MIN_FRONT = 2.5;
export type Zugang = {
	begehbar: Set<string>;
	parzellen: { id: string; art: 'bestand' | Eingriff['art']; cells: string[]; front: number }[];
};
export function zugang(r: Lage, b: Belegung): Zugang {
	const frei = (id: string) =>
		(!b.samples[address(id, 0)] || b.samples[address(id, 0)].group === WEG) &&
		b.boden.get(id) !== 'wasser';
	const queue = [...new Set(r.blocks.flatMap((x) => x.saum))].filter(frei),
		begehbar = new Set(queue);
	for (let i = 0; i < queue.length; i++)
		for (const w of required(r.nb.get(queue[i]), 'r.nb.get(queue[i])'))
			if (frei(w) && !begehbar.has(w)) {
				begehbar.add(w);
				queue.push(w);
			}
	const groups = new Map<string, string[]>();
	for (const [id, p] of b.plan)
		if (b.samples[address(id, 0)]?.group === BESTAND)
			groups.set(p.parcel, [...(groups.get(p.parcel) ?? []), id]);
	const parzellen: Zugang['parzellen'] = [...groups].map(([id, cells]) => ({
		id,
		cells,
		art: 'bestand',
		front: 0
	}));
	for (const e of b.eingriffe) {
		const cells = [...new Set(e.cells.filter(([, l]) => l === 0).map(([id]) => id))];
		if (cells.length) parzellen.push({ id: e.id, cells, art: e.art, front: 0 });
	}
	for (const p of parzellen)
		for (const c of p.cells) {
			const fronts: Front[] = required(r.nb.get(c), 'r.nb .get(c)')
				.filter((n) => begehbar.has(n))
				.flatMap((n) =>
					grenze(r.patch, c, n).map(([a, b], k) => ({
						id: `${c}|${n}:${k}`,
						a,
						b,
						level: 0,
						width: Math.hypot(
							required(r.point.get(c), 'r.point.get(c)')[0] -
								required(r.point.get(n), 'r.point.get(n)')[0],
							required(r.point.get(c), 'r.point.get(c)')[1] -
								required(r.point.get(n), 'r.point.get(n)')[1]
						),
						kind: 'alley' as const
					}))
				);
			p.front += frontage(cellOutline(r.patch, c), fronts, {
				level: 0,
				minFront: 1e-6,
				minWidth: 1e-6,
				minArea: 1,
				maxArea: 1,
				maxDepth: 0
			}).reduce((s, f) => s + f.length, 0);
		}
	return { begehbar, parzellen };
}
export function zugangSichern(r: Lage, b: Belegung): string[] {
	const removed: string[] = [];
	for (let round = 0; round < 3; round++) {
		const z = zugang(r, b);
		for (const p of z.parzellen.filter((p) => p.front < MIN_FRONT)) {
			if (p.art !== 'bestand') {
				const e = b.eingriffe.find((e) => e.id === p.id);
				if (e) {
					for (const [id, l] of e.cells) delete b.samples[address(id, l)];
					b.eingriffe = b.eingriffe.filter((x) => x !== e);
					removed.push(e.id);
				}
				continue;
			}
			const candidates = new Map<string, number>();
			for (const c of p.cells)
				for (const n of required(r.nb.get(c), 'r.nb.get(c)')) {
					const target = b.plan.get(n)?.parcel;
					if (target && target !== p.id && r.blockOf.get(c) === r.blockOf.get(n))
						candidates.set(target, (candidates.get(target) ?? 0) + 1);
				}
			const best = [...candidates].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
			if (best)
				for (const c of p.cells)
					b.plan.set(c, { ...required(b.plan.get(c), 'b.plan.get(c)'), parcel: best });
		}
	}
	return removed;
}
