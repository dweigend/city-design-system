import type { AssetHost } from '../../core/asset-registry';
import type { CellSpace, Parcel } from '../../domain/cell-space';
import type { CityLattice, LatticeVariant } from '../../domain/city-volume';
import type { AccessEdge } from '../../domain/movement-network';
import type { MemberGraph } from '../../domain/structure';

type Base = AssetHost<Parcel, CellSpace>;
type Edge = Extract<Base, { kind: 'plan-edge' | 'graph-edge' }> & Pick<AccessEdge, 'supports'>;

/** A resolved city placement host. Lattice readers may reuse a solved model from the current world. */
export type CityAssetHost =
	| Exclude<Base, { kind: 'plan-edge' | 'graph-edge' | 'lattice-bay' | 'frame' }>
	| Edge
	| Readonly<{
			kind: 'lattice-bay';
			id: string;
			datumZ: number;
			model: LatticeVariant;
			readLattice: (model: LatticeVariant) => CityLattice;
	  }>
	| Readonly<{ kind: 'frame'; id: string; graph: MemberGraph; memberIds?: readonly string[] }>;
