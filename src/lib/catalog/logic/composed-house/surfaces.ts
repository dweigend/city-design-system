import { BODY_TOKEN, type HouseUse } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import type { SlotAssignment } from '../assets';
import type { ColorToken } from '../parametrik/types';

export type Surface = SlotAssignment;
export type SurfaceSlot = HouseUse | 'frame' | 'deck' | 'pane' | 'access' | 'shell';
export type HouseSurfaces = Readonly<Record<SurfaceSlot, Surface>>;

const metal = (token: ColorToken): Surface => ({ token, finish: 'metal' });
/** Default assignments for the game and bible. Geometry accepts the same slots with any palette. */
export const houseSurfaces: HouseSurfaces = {
	frame: { token: '--ink', finish: 'perforated-metal' },
	deck: { token: '--paper', finish: 'beton-terrazzo' },
	shell: { token: '--paper', finish: 'metall-lackiert' },
	pane: { token: '--blueprint', finish: 'glas-klar' },
	access: metal(flowToken.people),
	living: { token: BODY_TOKEN.living, finish: 'metall-lackiert' },
	energy: metal(BODY_TOKEN.energy),
	water: metal(BODY_TOKEN.water),
	food: metal(BODY_TOKEN.food),
	material: metal(BODY_TOKEN.material)
};

const finishes = {
	base: 'beton-schalung',
	deck: 'beton-terrazzo',
	roof: 'corrugated-metal',
	screen: 'perforated-metal',
	capsule: 'acryl-matt',
	fitting: 'metall-messing',
	food: 'holz-natur'
} as const;
const defaults = new Set(Object.values(houseSurfaces));
/** Selects the catalogue finish for stock dressed with a default slot, preserving a caller's explicit assignment. */
export function roleSurface(surface: Surface, role: keyof typeof finishes): Surface {
	return defaults.has(surface) ? { token: surface.token, finish: finishes[role] } : surface;
}
