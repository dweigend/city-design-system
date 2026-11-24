import { columnRoof, type CityColumn } from '../../domain/city-volume';

/** Lattice level of the column's lowest full bay, above its highest corner. */
export function readBaseLevel(column: CityColumn, datumZ: number, levelHeightM: number): number {
	return (
		Math.round((columnRoof(column, datumZ, levelHeightM) - datumZ) / levelHeightM) - column.levels
	);
}
