import type { CityColumn } from '../../domain/city-volume';
import type { ParcelPlan } from '../../domain/parcels';
import type { ParcelHouseSite } from './parcel';

/** Indexes the private parcels of a town for the shared house placement rule, including
 * their addressed frontage, world-meter terrain sampler and area-based scale. */
export function createTownParcelSites(
	holdings: ParcelPlan,
	columns: ReadonlyMap<string, CityColumn>,
	datumZ: number,
	groundAt: NonNullable<ParcelHouseSite['groundAt']>
) {
	const parcels = new Map(holdings.parcels.map((parcel) => [parcel.id, parcel]));
	const blocks = new Map(holdings.blocks.map((block) => [block.id, block]));
	const portals = new Map(holdings.portals.map((portal) => [portal.id, portal]));
	return (parcelId: string): ParcelHouseSite | undefined => {
		const parcel = parcels.get(parcelId);
		if (!parcel || parcel.publicUse) return undefined;
		const block = blocks.get(parcel.blockId);
		const portal = portals.get(parcel.portalId);
		if (!block || !portal) return undefined;
		return {
			parcel,
			block,
			portal,
			columns,
			datumZ,
			linearToleranceM: holdings.linearToleranceM,
			groundAt,
			scale: 'by-area'
		};
	};
}
