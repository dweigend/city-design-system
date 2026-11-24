import { houseExample, type PlaceableObject } from '../../core/object';
import { existing, resolveSurfaces, type Drawable } from './index';

/** Applies the stock surface assignment to the fixed core object. */
export function example(house: PlaceableObject = houseExample()): Drawable[] {
	return resolveSurfaces(house, existing);
}
