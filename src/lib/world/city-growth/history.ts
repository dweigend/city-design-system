import { required } from '../../core/invariant';
import type { CityGrowthBuilding, CityGrowthEvent, CityGrowthHolding } from './types';

type RetiredBuilding = CityGrowthBuilding & Readonly<{ retiredYear: number }>;

export function createStock() {
	const holdings = new Map<string, CityGrowthHolding>();
	const buildings = new Map<string, CityGrowthBuilding>();
	const retiredBuildings: RetiredBuilding[] = [];
	return {
		holdings,
		buildings,
		retiredBuildings,
		add(event: CityGrowthEvent) {
			if (!('holding' in event || 'holdingId' in event || 'children' in event)) return;
			switch (event.kind) {
				case 'square-reserved':
					holdings.set(event.holding.id, event.holding);
					break;
				case 'holding-settled':
					holdings.set(event.holding.id, event.holding);
					buildings.set(event.holding.id, event.building);
					break;
				case 'holding-split':
					holdings.delete(event.predecessorId);
					for (const child of event.children) holdings.set(child.id, child);
					break;
				case 'building-infill':
				case 'building-extended': {
					const building = required(buildings.get(event.holdingId), 'building for addition');
					const parts = Object.freeze([...building.parts, ...event.parts]);
					buildings.set(event.holdingId, Object.freeze({ ...building, parts }));
					break;
				}
				case 'building-converted': {
					const building = required(buildings.get(event.holdingId), 'building for conversion');
					const { use, convertedYear } = event;
					const ids = new Set(event.partIds);
					const parts = Object.freeze(
						building.parts.map((part) =>
							ids.has(part.id) ? Object.freeze({ ...part, use, convertedYear }) : part
						)
					);
					buildings.set(event.holdingId, Object.freeze({ ...building, parts }));
					break;
				}
				case 'building-retired': {
					const building = required(buildings.get(event.holdingId), 'building for retirement');
					retiredBuildings.push(Object.freeze({ ...building, retiredYear: event.retiredYear }));
					buildings.delete(event.holdingId);
					break;
				}
			}
		}
	};
}

export function readPublicStock(events: readonly CityGrowthEvent[]) {
	return {
		crossings: Object.freeze(events.filter((event) => event.kind === 'crossing-built')),
		squares: Object.freeze(events.filter((event) => event.kind === 'square-reserved')),
		rail: Object.freeze(events.filter((event) => event.kind === 'rail-opened')),
		stations: Object.freeze(events.filter((event) => event.kind === 'station-opened')),
		assets: Object.freeze(
			events.flatMap((event) => (event.kind === 'asset-placed' ? [event.asset] : []))
		)
	};
}
