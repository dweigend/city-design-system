import { distance, measurePolygon } from '../../core/geometry';
import { required } from '../../core/invariant';
import { readCityColumns } from '../../domain/city-volume';
import type { ParcelBlock } from '../../domain/parcels';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels
} from '../city-site';

/** The perimeter holding and the merged hall used in the Town study. */
export type TownHouseBlock = 'block' | 'merged';

/** Reads two buildable examples from the default parcel plan. Selects the nearest perimeter
 * block with a reserved public court and the nearest single-parcel merged hall to the first
 * selected bridge landing. Returns their permanent addresses and city context. */
export function createTownHouseStudy() {
	const site = createCitySite();
	const layout = readCityGrid(site, citySiteParams.citySize.default);
	const holdings = readCityParcels(site, layout);
	const columns = new Map(
		readCityColumns(layout.grid, readCityDistricts(site, layout)).map((column) => [
			column.planCellId,
			column
		])
	);
	const parcelsByBlock = Map.groupBy(holdings.parcels, ({ blockId }) => blockId);
	const portals = new Map(holdings.portals.map((portal) => [portal.id, portal]));
	const landing = layout.grid.vertices.find(
		({ id }) => id === layout.selectedCrossings[0]?.heads[0].nodeId
	);
	const target = landing ? ([landing.position[0], landing.position[1]] as const) : site.origin;
	const ordered = holdings.blocks
		.map((block) => {
			const centre = measurePolygon(block.outline).centroid;
			return { block, distance: centre ? distance(centre, target) : Infinity };
		})
		.sort((a, b) => a.distance - b.distance);
	const find = (predicate: (block: ParcelBlock) => boolean) =>
		required(ordered.find(({ block }) => predicate(block))?.block, 'town house block');
	const blocks = {
		block: find(
			({ id, plannedKind, courtFit }) =>
				plannedKind === 'block' && courtFit === 'fit' && Boolean(parcelsByBlock.get(id)?.length)
		),
		merged: find(
			({ id, plannedKind, memberCellIds }) =>
				plannedKind === 'hall' && memberCellIds.length > 1 && parcelsByBlock.get(id)?.length === 1
		)
	};
	return { site, layout, holdings, columns, parcelsByBlock, portals, blocks };
}
