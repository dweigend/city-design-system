import { footprintBay } from './footprint';
import type { HouseSite } from '../composed-house';
import { STORY } from '../../data/grid';
/** Surveys stable site identity, actual painted storeys and the dominant ground-plane axis. */
export function survey(site: HouseSite) {
	const cells = [...site.cells].sort((a, b) => a.id.localeCompare(b.id));
	const rows = cells.map((c) => site.stacks.get(c.id) ?? []);
	const start = Math.min(...rows.map((row) => row.findIndex(Boolean)).filter((i) => i >= 0));
	const end = Math.max(...rows.map((row) => row.length));
	if (!Number.isFinite(start) || end <= start) throw new RangeError('Empty painted site');
	const programme = Array.from({ length: end - start }, (_, i) =>
		rows.map((r) => r[start + i]).filter(Boolean)
	);
	if (programme.some((p) => !p.length)) throw new RangeError('Unpainted interior storey');
	const {width, depth, x, y} = footprintBay(cells);
	const anchor = cells[0];
	const ground = anchor.pad;
	const living = new Set<number>();
	for (const row of rows)
		for (let i = start; i + 2 < row.length; i++)
			if (row[i] === 'living' && row[i + 1] === 'living' && row[i + 2] === 'living') {
				living.add(i - start);
				living.add(i + 1 - start);
			}

	return {
		id: cells[0].id + (start ? '@' + start : ''),
		cells,
		programme,
		living,
		ground,
		start,
		base: ground + start * STORY,
		width,
		depth,
		elongated: Math.max(width, depth) > 1.5 * Math.min(width, depth),
		compact: Math.min(width, depth) < 5.6, center: [x,y] as const,
		district: site.district ?? 'infill',
		seed: site.seed
	};
}
export type Survey = ReturnType<typeof survey>;
