import { required } from '../../core/invariant';
import type { CityColumn } from '../../domain/city-volume';

/** Selects a connected quarter of the columns in breadth-first plan order. */
export function readStructureQuarter(columns: readonly CityColumn[]): CityColumn[] {
	const seed = columns.find(({ kind }) => kind === 'block') ?? columns[0];
	if (!seed) return [];
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const result = [seed];
	const seen = new Set([seed.planCellId]);
	const count = Math.ceil(columns.length / /* Exact arithmetic: one quarter of the town. */ 4);
	for (let i = 0; i < result.length && result.length < count; i++) {
		for (const id of result[i].neighbors) {
			if (id === null || seen.has(id)) continue;
			seen.add(id);
			result.push(required(byId.get(id), 'neighboring town column'));
			if (result.length === count) break;
		}
	}
	return result;
}
