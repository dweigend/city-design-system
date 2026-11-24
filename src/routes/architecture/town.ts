import { PlaceableObject, move } from '../../lib/core/object';
import { levelHeight, readCityColumns, type CityColumn } from '../../lib/domain/city-volume';
import { createHouseObject, type HouseInputs } from '../../lib/domain/house-court';
import { projectHouse } from '../../lib/scene/house-projection';
import type { Drawable } from '../../lib/scene/surface';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid
} from '../../lib/world/city-site';
import { createBayHouse } from '../../lib/world/house-site';

const centre = (column: CityColumn) => {
	const n = column.corners.length;
	return column.corners.reduce(([x, y], { position: [u, v] }) => [x + u / n, y + v / n], [0, 0]);
};

/** Picks the block-district column at the first selected crossing of the default town (else the
 * block column nearest it) and fronts the house on the edge that starts at the crossing node. */
function chooseBay() {
	const city = createCitySite();
	const plan = readCityGrid(city, citySiteParams.citySize.default);
	const columns = readCityColumns(plan.grid, readCityDistricts(city, plan));
	const node = plan.selectedCrossings[0]?.heads[0].nodeId;
	const target = plan.grid.vertices.find(({ id }) => id === node)?.position ?? [0, 0];
	const blocks = columns.filter(({ kind }) => kind === 'block');
	const pool = blocks.length ? blocks : columns;
	const distanceTo = (column: CityColumn) =>
		Math.hypot(centre(column)[0] - target[0], centre(column)[1] - target[1]);
	const [bay] = [...pool].sort((a, b) => distanceTo(a) - distanceTo(b));
	const edge = Math.max(
		0,
		bay.corners.findIndex(({ id }) => id === node)
	);
	return { bay, edge, columns };
}

function context(bay: CityColumn, columns: readonly CityColumn[]) {
	const near = new Set(bay.neighbors.filter((id): id is string => id !== null));
	return PlaceableObject.create({
		id: 'town-context',
		slots: ['plot', 'court', 'mass'],
		parts: columns
			.filter(({ planCellId }) => near.has(planCellId))
			.map(({ planCellId, corners, levels }) => {
				const base = Math.min(...corners.map(({ position }) => position[2]));
				return {
					id: planCellId,
					slot: 'mass',
					shape: {
						kind: 'prism',
						polygon: corners.map(({ position: [x, y] }) => [x, y] as const),
						base,
						top: base + levels * levelHeight
					}
				};
			}),
		footprint: { width: 0, depth: 0 },
		anchors: []
	});
}

/** The house rule on one bay of the default town, ringed by its neighbour columns as see-through stock. */
export function townSheet(inputs: HouseInputs): { drawables: Drawable[]; bayId: string } {
	const { bay, edge, columns } = chooseBay();
	const { space, house } = createBayHouse(bay, [edge], inputs);
	const [x, y] = centre(bay);
	const z = space.baseZ;
	const local = (object: PlaceableObject) => move(object, [-x, -y, -z], 0);
	return {
		bayId: bay.planCellId,
		drawables: [
			...projectHouse(local(context(bay, columns)), 'transparent').map((d) => ({
				...d,
				id: `context/${d.id}`
			})),
			...projectHouse(local(createHouseObject(space, house, 'full')), 'full')
		]
	};
}
