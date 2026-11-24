import type { Catalog } from '../../core/catalog';
import type { AssetHost } from '../../core/asset-registry';
import type {
	CellSpace,
	CellSubgridGenerator,
	CellSubgridOptions,
	Parcel
} from '../../domain/cell-space';
import type { CityLattice, LatticeVariant } from '../../domain/city-volume';
import type { Parcel as PlanParcel } from '../../domain/parcels';
import type { ParcelHouseSite } from '../house-site';
import type { AccessEdge } from '../../domain/movement-network';
import type { MemberGraph } from '../../domain/structure';

type Base = AssetHost<Parcel, CellSpace>;
type ParcelHost = Extract<Base, { kind: 'parcel' }> &
	Readonly<{
		subgridId?: string;
		subgridOptions?: CellSubgridOptions;
		subgridCatalog?: Catalog<CellSubgridGenerator>;
	}>;
type Edge = Extract<Base, { kind: 'plan-edge' | 'graph-edge' }> & Pick<AccessEdge, 'supports'>;

/** A resolved city placement host. Lattice readers may reuse a solved model from the current world. */
export type CityAssetHost =
	| Exclude<Base, { kind: 'plan-edge' | 'graph-edge' | 'lattice-bay' | 'frame' | 'parcel' }>
	| Edge
	| ParcelHost
	| Readonly<{ kind: 'parcel'; parcel: PlanParcel; site: ParcelHouseSite }>
	| Readonly<{
			kind: 'lattice-bay';
			id: string;
			datumZ: number;
			model: LatticeVariant;
			readLattice: (model: LatticeVariant) => CityLattice;
	  }>
	| Readonly<{ kind: 'frame'; id: string; graph: MemberGraph; memberIds?: readonly string[] }>;
