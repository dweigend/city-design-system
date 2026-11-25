import { Random } from '../../core/random';
import {
	createHouseAssembly,
	type AdjoiningWall,
	type HouseDetail
} from '../../domain/house-court';
import type { PlacedParcelHouse } from '../../world/house-site';
import { stockPencilShare, type DisplayLevel } from '../focus';
import { projectCladHouse, type CladHouseOptions } from './clad';
import type { HouseMaterials } from './materials';

/** Draws addressed phases and uses through the standard cladding and detail pipeline. */
export function projectProgrammedHouse(
	{ space, house, style }: Pick<PlacedParcelHouse, 'space' | 'house' | 'style'>,
	detail: HouseDetail,
	walls: readonly AdjoiningWall[],
	faces: Parameters<typeof projectCladHouse>[1],
	materials: HouseMaterials,
	display: DisplayLevel,
	options: CladHouseOptions
) {
	const { object, addresses } = createHouseAssembly(
		space,
		house,
		detail,
		style,
		walls,
		options.addressed
	);
	const draw = Random.create({ seed: house.inputs.seed }).derive('stock');
	return projectCladHouse(object, faces, materials, display, {
		...options,
		program: {
			parts: new Map(
				addresses.filter(({ body, program }) => body && program).map((row) => [row.partId, row])
			),
			stock: draw.number() < stockPencilShare ? 'pencil' : 'transparent'
		}
	});
}
