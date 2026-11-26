import type { Bounds3, Vec2 } from '../../core/geometry';
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
import type { MemberGraph, SupportedFrame } from '../../domain/structure';

type Base = AssetHost<Parcel, CellSpace>;
type ParcelHost = Extract<Base, { kind: 'parcel' }> &
	Readonly<{
		subgridId?: string;
		subgridOptions?: CellSubgridOptions;
		subgridCatalog?: Catalog<CellSubgridGenerator>;
	}>;
type Edge = Extract<Base, { kind: 'plan-edge' | 'graph-edge' }> & Pick<AccessEdge, 'supports'>;

type SupportedFrameHost = Readonly<{
	kind: 'frame';
	id: string;
	frame: SupportedFrame;
	occupiedBounds?: readonly Bounds3[];
}>;

/** A resolved city placement host. Lattice readers may reuse a solved model from the current world. */
export type CityAssetHost =
	| Exclude<Base, { kind: 'plan-edge' | 'graph-edge' | 'lattice-bay' | 'frame' | 'parcel' }>
	| Edge
	| ParcelHost
	| Readonly<{ kind: 'parcel'; parcel: PlanParcel; site: ParcelHouseSite }>
	| Readonly<{
			kind: 'parcel';
			parcel: Pick<PlanParcel, 'id' | 'outline'>;
			groundAt: (point: Vec2) => number;
			holes?: readonly (readonly Vec2[])[];
	  }>
	| Readonly<{
			kind: 'lattice-bay';
			id: string;
			datumZ: number;
			levelHeightM?: number;
			model: LatticeVariant;
			readLattice: (model: LatticeVariant) => CityLattice;
	  }>
	| Readonly<{ kind: 'frame'; id: string; graph: MemberGraph; memberIds?: readonly string[] }>
	| SupportedFrameHost;
