import type { Primitive } from '../parametrik/types';
import { sideLength, type QuadCell } from '../quad-grid';
import { part } from './form';
import type { Mass } from './massing';

const COLUMN_SETBACK = 0.38;
const COLUMN_RADIUS = 0.18;

/** One round column beneath the middle of each perimeter bay, including courtyard bays. */
export function pilotis(
	mass: Mass,
	cells: readonly QuadCell[],
	height: number,
	inset: number
): Primitive[] {
	const members = new Set(cells.map((cell) => cell.id));
	return cells.flatMap((cell) =>
		cell.neighbors.flatMap((neighbor, side) => {
			if (neighbor !== null && members.has(neighbor)) return [];
			const a = cell.corners[side];
			const b = cell.corners[(side + 1) % 4];
			const x = (a[0] + b[0]) / 2;
			const y = (a[1] + b[1]) / 2;
			const length = sideLength(cell, side);
			const offset = (inset * COLUMN_SETBACK) / length;
			return part(mass.id + ':piloti' + cell.id + '.' + side, '--paper', {
				kind: 'cylinder',
				position: [x - (b[1] - a[1]) * offset, y + (b[0] - a[0]) * offset, mass.floor],
				radius: inset * COLUMN_RADIUS,
				height
			});
		})
	);
}
