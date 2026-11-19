import { flowToken } from '../../data/focus';

/** Wall colour of each use. Housing takes the pale planning tint; paths alone stay pink. */
export const BODY_TOKEN = {
	living: '--body-living',
	water: flowToken.water,
	energy: flowToken.energy,
	food: flowToken.food,
	material: flowToken.material
} as const;
