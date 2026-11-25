/** Module: Composes city lanes, crossings, walkways and transit access into a graph. */
import { required } from '../../core/invariant';
import type { CityColumn } from '../../domain/city-volume';
import { createMovementNetwork, type MovementNode } from '../../domain/movement-network';
import { riverCityRecipe, type CityGrid, type CitySite } from '../city-site';
import { defaults } from '../../../config/city-movement';
import { groundLanes } from './ground';
import { link, raised, support, type Link } from './links';
import { cityRail, type CityRailOptions } from './rail';
import { stairSurvey } from './stairs';
import { walkways } from './walkways';

/** City adapter kinds. Chapter views may attach their own presentation to them. */
export type { CityMovementKind } from './links';

/** Alternative walkway planes relative to the derived eaves plane. */
export const walkwayLevelOffsets = defaults.walkwayLevelOffsets;

/** Caller-selected rail survey origin, station catchment centres and terrain upper bounds. */
export type { CityRailOptions } from './rail';

/** Grade bound used by the Paths valley fixture to envelope its terrain samples. */
export const cityRailTerrainSlopeBound = defaults.railTerrainSlopeBoundRatio;
/** Along-valley spacing available to callers laying out town station catchments. */
export const cityRailCatchmentSpacingM = defaults.railCatchmentSpacingM;

/** Surveys the regional rail once per city layout, independently of the displayed walkway level. */
export function readCityRail(
	site: CitySite,
	layout: CityGrid,
	columns: readonly CityColumn[],
	options: CityRailOptions
) {
	return cityRail(
		site,
		layout,
		groundLanes(site, layout),
		columns,
		options,
		(site.recipe ?? riverCityRecipe).levelHeightM
	);
}

/** Composes plan lanes, selected crossings, the eaves walkways and platform access into one graph.
 * Plan vertices retain ground/<plan-vertex> addresses, and portalNodeIds maps permanent entrances to graph nodes.
 * Empty walkway centers build only ground and platform access. */
export function readCityMovement(
	site: CitySite,
	layout: CityGrid,
	columns: readonly CityColumn[],
	offset: number,
	rail: ReturnType<typeof readCityRail>,
	walkwayCenters: readonly string[]
) {
	const { levelHeightM } = site.recipe ?? riverCityRecipe;
	const ground = groundLanes(site, layout);
	const stair = stairSurvey(site, columns, layout.datumZ, levelHeightM, ground.clear);
	const upper = walkways(
		site,
		ground,
		columns,
		layout.datumZ,
		levelHeightM,
		offset,
		walkwayCenters,
		stair
	);
	const nodes = new Map(
		[...ground.nodes.values(), ...ground.frontage.values(), ...upper.nodes.values()].map((node) => [
			node.id,
			node
		])
	);
	const docks: Link[] = [];
	for (const station of rail?.stations ?? []) {
		const approach = required(nodes.get(station.approachId), 'rail approach');
		const z = station.position[2];
		const level = Math.round((z - layout.datumZ) / levelHeightM);
		const platform: MovementNode = {
			id: 'station/' + station.id,
			position: station.position,
			level
		};
		const top = raised(approach, level, z);
		if (top.position[0] === platform.position[0] && top.position[1] === platform.position[1]) {
			const access = stair('dock-stair/' + station.id, approach, platform);
			if (!access) continue;
			nodes.set(platform.id, platform);
			docks.push(access);
			continue;
		}
		if (!nodes.has(top.id)) {
			const access = stair('station-stair/' + station.id, approach, top);
			if (!access) continue;
			nodes.set(top.id, top);
			docks.push(access);
		}
		nodes.set(platform.id, platform);
		docks.push(link('dock/' + station.id, 'walkway', top, platform, [], [support(approach, top)]));
	}
	const network = createMovementNetwork(
		[...nodes.values()],
		[...ground.links, ...upper.links, ...docks]
	);
	return {
		network,
		portalNodeIds: ground.portalNodeIds,
		level: upper.level,
		elevationM: upper.z,
		elevatedNodeIds: new Map([...upper.nodes].map(([vertex, node]) => [vertex, node.id]))
	};
}
