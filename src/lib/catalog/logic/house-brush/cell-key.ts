import { hashUnit } from '../../core/random';
import type { QuadCell } from '../quad-grid';

/** Stable random address, retaining the original draws on lattice carriers. */
export function cellKey(cell: QuadCell): number {
	return cell.latticeKey ?? Math.floor(hashUnit(0, cell.id) * 0x1_0000_0000);
}
