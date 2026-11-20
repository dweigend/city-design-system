import { flowToken, type FlowId } from './focus';

/** Token and drawn sections (meters) for house and rooftop frames. */
export const HOUSE_FRAME = { token: '--ink-3', primary: 0.12, secondary: 0.08 } as const;

/** Wall colour of each use, worn as one saturated field. Housing is violet; paths alone stay pink. */
export const BODY_TOKEN = {
	living: '--body-living',
	water: flowToken.water,
	energy: flowToken.energy,
	food: flowToken.food,
	material: flowToken.material
} as const;

/**
 * Counter colour of each use for screens, parapets and railings: the field's strongest contrast
 * among the palette tokens. Path pink is never a counter colour.
 */
export const COUNTER_TOKEN = {
	living: '--cat-mobility',
	water: '--signal',
	energy: '--blueprint',
	food: '--signal',
	material: '--blueprint'
} as const satisfies Record<HouseUse, string>;

/** Saturated use pigment for the selected occupied body in a composed house. */
export const ACCENT_TOKEN = BODY_TOKEN;

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
