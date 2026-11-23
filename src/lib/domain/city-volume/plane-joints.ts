import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { cornerAt, planeElevation, type columnPlanes } from './foundation';
import type { Column } from './frame';
import type { PlanTopology } from './plan-topology';

/** What a level plane holds: the plan corners, the cell centres (the dual), the edge midpoints
 * (the medial plan) or one foot per cell on its foundation cap. */
export type PlaneKind = 'plan' | 'centre' | 'medial' | 'foot';

/** A lattice model as a rule over level planes. */
export type PlaneRule = Readonly<{
	plane: (level: number, aboveBase: number) => PlaneKind;
}>;

export type Joint = Readonly<{ id: string; position: Vec3; level: number; corner?: Corner }>;
/** Occupied span and foundation cap of each column on the shared planes. */
export type ColumnBands = (id: string) => ReturnType<typeof columnPlanes>;
type Corner = Column['corners'][number];
/** Joint factory of one lattice: every joint is created once and keyed by plan address and level. */
export function jointsOf(topology: PlanTopology, datumZ: number) {
	const joints = new Map<string, Joint>();
	const at = (id: string, level: number, position: () => Vec3, corner?: Corner) => {
		let joint = joints.get(id);
		if (!joint) {
			joint = Object.freeze({ id, level, corner, position: Object.freeze(position()) });
			joints.set(id, joint);
		}
		return joint;
	};
	const z = (level: number) => planeElevation(datumZ, level);
	return {
		corner(corner: Corner, level: number) {
			const anchor = cornerAt(corner, datumZ, level);
			return at(anchor.id, anchor.level, () => anchor.position, corner);
		},
		centre(cell: string, level: number) {
			return at(`cell/${cell}/level/${level}`, level, () => {
				const [x, y] = required(topology.centres.get(cell), 'cell centre');
				return [x, y, z(level)];
			});
		},
		middle(key: string, level: number) {
			return at(`edge/${key}/level/${level}`, level, () => {
				const { ends } = required(topology.edges.get(key), 'plan edge');
				const [[ax, ay], [bx, by]] = ends.map(({ position }) => position);
				return [(ax + bx) / 2, (ay + by) / 2, z(level)];
			});
		}
	};
}

export type Joints = ReturnType<typeof jointsOf>;
