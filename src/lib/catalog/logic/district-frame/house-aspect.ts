import { hashUnit } from '../../core/random';

/** Stable cantilever direction and access handedness, independent of the programme collapse. */
export function houseAspect(id: string, seed: number) {
	const axis = Math.floor(hashUnit(seed, id, 'cantilever') * 4);
	return {
		x: [1, 0, -1, 0][axis],
		y: [0, 1, 0, -1][axis],
		reverse: hashUnit(seed, id, 'access') < 0.5
	};
}
