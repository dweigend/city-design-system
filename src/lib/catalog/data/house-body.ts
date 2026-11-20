import { flowToken, type FlowId } from './focus';

/** Token and drawn sections (meters) for house and rooftop frames. */
export const HOUSE_FRAME = { token: '--ink-3', primary: 0.12, secondary: 0.08 } as const;

/** Wall colour of each use. Housing takes the pale planning tint; paths alone stay pink. */
export const BODY_TOKEN = {
	living: '--body-living',
	water: flowToken.water,
	energy: flowToken.energy,
	food: flowToken.food,
	material: flowToken.material
} as const;

/**
 * Use of a story. `living` is the plain house without a flow color; the other uses carry
 * the color of their flow. People and paths keep their own color for walkways and rail.
 */
export type HouseUse = 'living' | Exclude<FlowId, 'people'>;

/**
 * Painted stories per grid cell: the use of every story from the ground up. A cell without
 * stories has no entry. Stacks are contiguous; the level of a story is its index. The cell
 * id is the stable anchor: it survives every re-derivation of the grid.
 */
export type Stacks = ReadonlyMap<string, readonly HouseUse[]>;
