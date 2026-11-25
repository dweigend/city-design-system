import { conduits, powerStation } from './conduits';
import {
	districtFit,
	grove,
	houseDrawing,
	houses,
	infrastructure,
	rectangle,
	slab
} from './district';
import { retention, storage, waterworks, type Condition, type Measures } from './waterworks';

const park = grove('district/grove', rectangle(29, 4, 43, 26), 0.05, 84);
const ground = [
	...waterworks,
	...powerStation,
	slab('district/service-lane', rectangle(-43, -5, 41, 4), 0, 0.12, '--paper-3'),
	...park,
	...conduits
].map(infrastructure);

const district = {
	id: 'supply-district',
	buildingIds: houses.map(({ id }) => id),
	partIds: [...ground, ...houses.flatMap(({ drawables }) => drawables)].map(({ id }) => id)
};
const solidHouses = houseDrawing(false);
const transparentHouses = houseDrawing(true);
const roofs = houses.flatMap(({ roofBeds }) => roofBeds);

/** R19 Picture 1. Fixed illustrations share one district and camera. */
export function spongePicture(condition: Condition, measures: Measures) {
	const cistern = storage(condition, measures);
	const drawables = [
		...ground,
		...retention(condition, measures).map(infrastructure),
		...cistern.drawables.map(infrastructure),
		...(measures === 'sponge' ? roofs : [])
	];
	return {
		district,
		storage: cistern.label,
		fit: districtFit,
		view: 'iso' as const,
		drawables: [...drawables, ...solidHouses],
		transparent: [...drawables, ...transparentHouses]
	};
}
