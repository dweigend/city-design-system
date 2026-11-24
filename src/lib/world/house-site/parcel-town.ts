import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
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
import { createTownParcelSites } from './town-sites';

/** The perimeter holding, its neighbouring perimeter block and the merged hall of the Town study. */
export type TownHouseBlock = 'block' | 'neighbour' | 'merged';

/** Reads three buildable examples from the default parcel plan on a valley of the given relief
 * (default: the valley default). Selects the nearest perimeter block with a reserved public court and an eligible neighbour
 * and the nearest single-parcel merged hall to the first selected bridge landing, and the perimeter
 * block nearest the first that shares a lane with it. Returns their permanent addresses, the city
 * context and `groundAt`, the sampled ground elevation at a plan point. */
export function createTownHouseStudy(settings: Readonly<{ relief?: number }> = {}) {
	const site = createCitySite(undefined, settings);
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
	const perimeter = ordered.filter(
		({ block: { id, plannedKind } }) =>
			plannedKind === 'block' &&
			Boolean(parcelsByBlock.get(id)?.some(({ publicUse }) => !publicUse))
	);
	const pair = perimeter
		.filter(({ block }) => block.courtFit === 'fit')
		.find(({ block }) =>
			perimeter.some(
				({ block: candidate }) =>
					candidate !== block && candidate.laneIds.some((lane) => block.laneIds.includes(lane))
			)
		);
	const block = required(pair?.block, 'perimeter block with a neighbouring town block');
	const lanes = new Set(block.laneIds);
	const centre = required(measurePolygon(block.outline).centroid, 'town block centre');
	const neighbour = required(
		perimeter
			.filter(
				({ block: candidate }) =>
					candidate !== block && candidate.laneIds.some((lane) => lanes.has(lane))
			)
			.map(({ block: candidate }) => ({
				candidate,
				distance: distance(measurePolygon(candidate.outline).centroid ?? target, centre)
			}))
			.sort((a, b) => a.distance - b.distance)[0]?.candidate,
		'neighbouring town block'
	);
	const blocks = {
		block,
		neighbour,
		merged: find(
			({ id, plannedKind, memberCellIds }) =>
				plannedKind === 'hall' && memberCellIds.length > 1 && parcelsByBlock.get(id)?.length === 1
		)
	};
	const groundAt = ([x, y]: Vec2) => site.sampleGround(x, y).height;
	const readParcelSite = createTownParcelSites(holdings, columns, layout.datumZ, groundAt, {
		vertical: site.recipe
	});
	return {
		site,
		layout,
		holdings,
		columns,
		parcelsByBlock,
		portals,
		blocks,
		groundAt,
		readParcelSite
	};
}
