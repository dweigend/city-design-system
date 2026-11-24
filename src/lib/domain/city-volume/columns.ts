import { cityVolumeConfig } from '../../../config/city-volume';
import type { Vec3 } from '../../core/geometry';
import type { LatticePoint } from './foundation';

/** One plan cell's keyed terrain ring, neighboring cells and nominal level count. */
export type StructuralColumn = Readonly<{
	planCellId: string;
	corners: readonly LatticePoint[];
	neighbors: readonly (string | null)[];
	levels: number;
	groundAtHub?: number;
}>;

function validateRing({ planCellId, corners }: StructuralColumn, positions: Map<string, Vec3>) {
	if (corners.length < 3) throw new RangeError('City columns require at least three corners');
	const ring = new Set<string>();
	for (const { id, position } of corners) {
		if (ring.has(id))
			throw new RangeError(`Duplicate city corner ID "${id}" in column "${planCellId}"`);
		ring.add(id);
		const [x, y, z] = position;
		if (position.length !== 3 || ![x, y, z].every(Number.isFinite))
			throw new RangeError('City corners require three finite coordinates');
		const shared = positions.get(id);
		if (shared && shared.some((value, axis) => value !== position[axis]))
			throw new RangeError(`Conflicting positions for city corner ID "${id}"`);
		positions.set(id, position);
	}
}

/** Checks the addresses and coordinates before any shared joints are allocated. */
export function validateColumns(columns: readonly StructuralColumn[], maxLevels: number) {
	if (!Number.isSafeInteger(maxLevels) || maxLevels < 1)
		throw new RangeError('Expected a positive whole city level cap');
	const cells = new Set<string>();
	const positions = new Map<string, Vec3>();
	for (const column of columns) {
		const { planCellId, levels } = column;
		if (cells.has(planCellId))
			throw new RangeError(`Duplicate city column cell ID "${planCellId}"`);
		cells.add(planCellId);
		if (!Number.isInteger(levels) || levels < 1 || levels > maxLevels)
			throw new RangeError(`City columns require 1–${maxLevels} whole levels`);
		validateRing(column, positions);
	}
}

/** Returns validated columns in input order with immutable structural data. */
export function createStructuralColumns<C extends StructuralColumn>(
	columns: readonly C[],
	maxLevels: number = cityVolumeConfig.maximumColumnLevels
): readonly (StructuralColumn & Readonly<Omit<C, keyof StructuralColumn>>)[] {
	validateColumns(columns, maxLevels);
	const corners = new Map<LatticePoint, LatticePoint>();
	const freezeCorner = (corner: LatticePoint) => {
		let frozen = corners.get(corner);
		if (!frozen) {
			frozen = Object.freeze({ ...corner, position: Object.freeze([...corner.position] as Vec3) });
			corners.set(corner, frozen);
		}
		return frozen;
	};
	return Object.freeze(
		columns.map((column) =>
			Object.freeze({
				...column,
				corners: Object.freeze(column.corners.map(freezeCorner)),
				neighbors: Object.freeze([...column.neighbors])
			})
		)
	);
}
