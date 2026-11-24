import { PlaceableObject, move } from '../../lib/core/object';
import { levelHeight, readCityColumns, type CityColumn } from '../../lib/domain/city-volume';
import {
	createHouseObject,
	houseFigures,
	houseStyles,
	type HouseInputs,
	type HouseStyleName
} from '../../lib/domain/house-court';
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

/** The default town, its datum and the block columns nearest its first selected crossing, each
 * fronting the edge closest to that crossing. */
function chooseBays(count: number) {
	const city = createCitySite();
	const plan = readCityGrid(city, citySiteParams.citySize.default);
	const columns = readCityColumns(plan.grid, readCityDistricts(city, plan));
	const node = plan.selectedCrossings[0]?.heads[0].nodeId;
	const target = plan.grid.vertices.find(({ id }) => id === node)?.position ?? [0, 0];
	const away = ([x, y]: readonly number[]) => Math.hypot(x - target[0], y - target[1]);
	const blocks = columns.filter(({ kind }) => kind === 'block');
	const bays = [...(blocks.length ? blocks : columns)]
		.sort((a, b) => away(centre(a)) - away(centre(b)))
		.slice(0, count);
	const frontage = (bay: CityColumn) => {
		const n = bay.corners.length;
		const mid = (i: number) =>
			[0, 1].map((k) => (bay.corners[i].position[k] + bay.corners[(i + 1) % n].position[k]) / 2);
		return bay.corners.map((_, i) => i).sort((a, b) => away(mid(a)) - away(mid(b)))[0];
	};
	return { bays: bays.map((bay) => ({ bay, edge: frontage(bay) })), columns, datumZ: plan.datumZ };
}

function stock(chosen: readonly CityColumn[], columns: readonly CityColumn[]) {
	const taken = new Set(chosen.map(({ planCellId }) => planCellId));
	const near = new Set(
		chosen.flatMap(({ neighbors }) =>
			neighbors.filter((id): id is string => id !== null && !taken.has(id))
		)
	);
	return PlaceableObject.create({
		id: 'town-stock',
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

/** The house rule on bays of the default town, one style per bay, ringed by see-through stock.
 * Figures are those of the first bay's house. */
export function townSheet(inputs: HouseInputs, styles: readonly HouseStyleName[]) {
	const { bays, columns, datumZ } = chooseBays(styles.length);
	const placed = bays.map(({ bay, edge }, k) => ({
		bay,
		style: houseStyles[styles[k]],
		...createBayHouse(bay, datumZ, [edge], inputs, houseStyles[styles[k]])
	}));
	const [x, y] = centre(bays[0].bay);
	const local = (object: PlaceableObject) => move(object, [-x, -y, -datumZ], 0);
	const drawables: Drawable[] = [
		...projectHouse(
			local(
				stock(
					bays.map(({ bay }) => bay),
					columns
				)
			),
			'transparent'
		).map((d) => ({ ...d, id: `stock/${d.id}` })),
		...placed.flatMap(({ space, house, style }) =>
			projectHouse(local(createHouseObject(space, house, 'full', style)), 'full')
		)
	];
	return { drawables, figures: houseFigures(placed[0].space, placed[0].house) };
}
