import { BODY_TOKEN, type HouseUse } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import type { SlotAssignment } from '../assets';
import type { ColorToken } from '../parametrik/types';

export type Surface = SlotAssignment;
/** `anchor` paints the whole accent body, also on kit bodies: the one colour body of an ensemble. */
export type BandAccent = 'none' | 'window' | 'wall' | 'storey' | 'anchor';
export type SurfaceSlot = HouseUse | 'frame' | 'deck' | 'pane' | 'access' | 'shell';
export type HouseSurfaces = Readonly<Record<SurfaceSlot, Surface>>;

const walkingFinish = 'holz-natur';
const metal = (token: ColorToken): Surface => ({ token, finish: 'metal' });
/** Default assignments for the game and bible. Geometry accepts the same slots with any palette. */
export const houseSurfaces: HouseSurfaces = {
	frame: { token: '--ink-3', finish: 'metall-lackiert' },
	deck: { token: '--paper', finish: walkingFinish },
	shell: { token: '--paper', finish: 'acryl-matt' },
	pane: { token: '--paper', finish: 'glas-klar' },
	access: metal(flowToken.people),
	living: { token: BODY_TOKEN.living, finish: 'metall-lackiert' },
	energy: metal(BODY_TOKEN.energy),
	water: metal(BODY_TOKEN.water),
	food: metal(BODY_TOKEN.food),
	material: metal(BODY_TOKEN.material)
};

const finishes = {
	base: 'beton-terrazzo',
	deck: walkingFinish,
	roof: 'corrugated-metal',
	terrace: 'beton-schalung',
	screen: 'perforated-metal',
	capsule: 'acryl-matt',
	glazing: 'glas-klar',
	fitting: 'metall-messing',
	rim: 'metal',
	lining: 'beton-schalung',
	enamel: 'metall-lackiert',
	trim: 'fired-slip'
} as const;
/** Whole band bodies take calm, light finishes only. Chipboard and graphite read as blotches and as
 * heavy dark masses at town scale. */
const bandFinishes = {
	living: 'metall-lackiert',
	food: 'keramik-glasiert',
	energy: 'beton-schalung',
	material: 'metall-lackiert',
	water: 'beton-terrazzo'
} as const;
const defaults = new Set(Object.values(houseSurfaces));
/** Applies a role finish to a stock slot, respecting a caller-supplied surface. */
export function roleSurface(
	surface: Surface,
	role: keyof typeof finishes,
	token: ColorToken = surface.token
): Surface {
	// A walking surface in the access colour stays plain: a patterned finish under the pink reads as
	// blotches from town distance.
	if (surface === houseSurfaces.access) return surface;
	return defaults.has(surface) ? { token, finish: finishes[role] } : surface;
}
/** Dresses an opaque course from its actual use, with pigment on the selected band. */
export function bandSurface(surface: Surface, use: HouseUse, accent: boolean): Surface {
	return defaults.has(surface)
		? { token: accent ? surface.token : '--paper', finish: bandFinishes[use] }
		: surface;
}
