import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodeKey, type Key } from '../../core/ref';
import { planeElevation, planeIndex, type columnPlanes, type CornerReader } from './foundation';
import type { StructuralColumn } from './columns';
import type { LatticePoint } from './bay-addresses';
import type { PlanTopology } from './plan-topology';

/** What a level plane holds: the plan corners, the cell centres (the dual), the edge midpoints
 * (the medial plan) or one foot per cell on its foundation cap. */
export type PlaneKind = 'plan' | 'centre' | 'medial' | 'foot';

/** A lattice model as a rule over level planes. */
export type PlaneRule = Readonly<{
	plane: (level: number, aboveBase: number) => PlaneKind;
}>;

export type Joint = LatticePoint &
	Readonly<{
		level: number;
		plane?: number;
		corner?: Corner;
	}>;
/** Occupied span and foundation cap of each column on the shared planes. */
export type ColumnBands = (id: string) => ReturnType<typeof columnPlanes>;
type Corner = StructuralColumn['corners'][number];
/** Joint factory of one lattice: every joint is created once and keyed by plan address and level. */
export function jointsOf(
	topology: PlanTopology,
	datumZ: number,
	readCorner: CornerReader['read'],
	levelHeightM: number
) {
	const joints = new Map<string, Joint>();
	const at = (
		address: Key,
		id: string,
		level: number,
		position: () => Vec3,
		corner?: Corner,
		groundContact?: true
	) => {
		const key = encodeKey(address);
		let joint = joints.get(key);
		if (!joint) {
			const point = Object.freeze(position());
			const index = corner && level === 0 ? planeIndex(datumZ, point[2], levelHeightM) : level;
			joint = Object.freeze({
				id,
				level,
				plane: Number.isSafeInteger(index) ? index : undefined,
				corner,
				...(groundContact && { groundContact }),
				position: point
			});
			joints.set(key, joint);
		}
		return joint;
	};
	const z = (level: number) => planeElevation(datumZ, level, levelHeightM);
	return {
		corner(corner: Corner, level: number) {
			const { point, level: index } = readCorner(corner, level);
			return at(
				['vertex', corner.id, index],
				point.id,
				index,
				() => point.position,
				corner,
				point.groundContact
			);
		},
		centre(cell: string, level: number) {
			return at(['cell', cell, level], `cell/${cell}/level/${level}`, level, () => {
				const [x, y] = required(topology.centres.get(cell), 'cell centre');
				return [x, y, z(level)];
			});
		},
		middle(key: string, level: number) {
			return at(['edge', key, level], `edge/${key}/level/${level}`, level, () => {
				const { ends } = required(topology.edges.get(key), 'plan edge');
				const [[ax, ay], [bx, by]] = ends.map(({ position }) => position);
				return [(ax + bx) / 2, (ay + by) / 2, z(level)];
			});
		}
	};
}

export type Joints = ReturnType<typeof jointsOf>;
