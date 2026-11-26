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
			switch (event.kind) {
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
