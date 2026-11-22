import type { TerrainCell } from '../terrain-grid';

/** Surveys sky-open courts enclosed by four dry building plots of the same old-town district.
 * Keep one court per carrier block and keep the surrounding plots on the frontage. */
export function surveyEnclosedCourts(
	cells: ReadonlyMap<string, TerrainCell>,
	oldTown: ReadonlySet<string>,
	paths: ReadonlySet<string>,
	occupied: ReadonlySet<string>
) {
	const found = new Map<
		string,
		{ court: TerrainCell; enclosure: TerrainCell[]; frontage: number }
	>();
	for (const id of oldTown) {
		const court = cells.get(id);
		if (!court || occupied.has(id)) continue;
		const enclosure = court.neighbors.flatMap((side) => {
			const cell = side === null ? undefined : cells.get(side);
			return cell && oldTown.has(cell.id) && !occupied.has(cell.id) ? [cell] : [];
		});
		if (enclosure.length !== 4) continue;
		const frontage = enclosure.filter((cell) =>
			cell.neighbors.some((n) => n !== null && paths.has(n))
		).length;
		if (!frontage) continue;
		const previous = found.get(court.block);
		if (
			previous &&
			(previous.frontage > frontage ||
				(previous.frontage === frontage && previous.court.index < court.index))
		)
			continue;
		found.set(court.block, { court, enclosure, frontage });
	}
	const reserved = new Set<string>();
	const walls = new Set<string>();
	const courts = [];
	const ordered = [...found.entries()].sort(([, a], [, b]) => a.court.index - b.court.index);
	for (const [block, { court, enclosure }] of ordered) {
		if (walls.has(court.id) || enclosure.some(({ id }) => reserved.has(id))) continue;
		reserved.add(court.id);
		for (const { id } of enclosure) walls.add(id);
		courts.push({ block, court: court.id, enclosure: enclosure.map(({ id }) => id) });
	}
	return courts;
}
