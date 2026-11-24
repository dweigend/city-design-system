import type { Vec3 } from '../geometry';

type EdgeHost<Kind extends 'plan-edge' | 'graph-edge'> = Readonly<{
	kind: Kind;
	id: string;
	points: readonly Vec3[];
}>;

/** Resolved placement inputs in world meters. A composition supplies its parcel and cell data. */
export type AssetHost<
	Parcel extends { readonly id: string } = { readonly id: string },
	CellSpace extends { readonly id: string } = { readonly id: string }
> =
	| Readonly<{ kind: 'ground'; point: Vec3 }>
	| Readonly<{ kind: 'parcel'; parcel: Parcel }>
	| Readonly<{ kind: 'cell-space'; space: CellSpace }>
	| Readonly<{ kind: 'lattice-bay'; id: string }>
	| Readonly<{ kind: 'frame'; id: string }>
	| EdgeHost<'plan-edge'>
	| EdgeHost<'graph-edge'>;

type AddressKind = Exclude<AssetHost['kind'], 'ground'>;

/** Local host address. Scope it with a Ref before storing it outside its topology. */
export type HostAddress =
	| Extract<AssetHost, { kind: 'ground' }>
	| { [Kind in AddressKind]: Readonly<{ kind: Kind; id: string }> }[AddressKind];

/** A rebuildable placement. Persist explicit resolved parameters to retain defaults at save time. */
export type Placement = Readonly<{
	assetId: string;
	host: HostAddress;
	params: Readonly<Record<string, number>>;
	seed: number;
}>;
