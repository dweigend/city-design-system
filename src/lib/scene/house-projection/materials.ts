import type { HouseStyleName } from '../../domain/house-court';
import type { Family } from '../material';

/** Surface families per style row and role slot, for wall faces and for roof faces. A slot without
 * a family stays a flat tone: Memphis colour blocks and coloured roofs keep their flat colour, and
 * curved fills have no planar face to clad. The function colours of paths stay off cladding
 * (COLOR-3). */
export type HouseMaterials = Readonly<{
	wall: Readonly<Partial<Record<string, Family>>>;
	roof: Readonly<Partial<Record<string, Family>>>;
}>;

/** The material assignment of every style row. */
export const houseMaterials = Object.freeze({
	neutral: { wall: { wall: 'masonry', mass: 'masonry' }, roof: { wall: 'metal', mass: 'metal' } },
	memphis: {
		wall: { 'body-white': 'render', 'body-timber': 'timber', wall: 'render', mass: 'render' },
		roof: { 'body-white': 'paving', 'body-timber': 'metal', wall: 'metal', mass: 'metal' }
	},
	archigram: { wall: { mass: 'metal' }, roof: { mass: 'metal' } },
	organic: { wall: { mass: 'render' }, roof: { mass: 'render' } }
} as const satisfies Record<HouseStyleName, HouseMaterials>);
