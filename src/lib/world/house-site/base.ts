import { columnRoof, levelHeight, type CityColumn } from '../../domain/city-volume';

/** Lattice level of the column's lowest full bay, above its highest corner. */
export function readBaseLevel(column: CityColumn, datumZ: number): number {
	return Math.round((columnRoof(column, datumZ) - datumZ) / levelHeight) - column.levels;
}
