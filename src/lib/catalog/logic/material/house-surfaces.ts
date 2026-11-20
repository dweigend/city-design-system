import { ACCENT_TOKEN, type HouseUse } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import type { SlotAssignment } from '../assets';
import type { ColorToken } from '../parametrik/types';

type Surface = SlotAssignment;
export type SurfaceSlot = HouseUse | 'frame' | 'deck' | 'pane' | 'access' | 'shell';
export type HouseSurfaces<T = Surface> = Readonly<Record<SurfaceSlot, T>>;

const walkingFinish = 'holz-natur';
const metal = (token: ColorToken): Surface => ({ token, finish: 'metal' });
/** Default assignments for the game and bible. Geometry accepts the same slots with any palette. */
export const houseSurfaces: HouseSurfaces = {
	frame: { token: '--ink-3', finish: 'metall-lackiert' },
	deck: { token: '--paper', finish: walkingFinish },
	shell: { token: '--paper', finish: 'acryl-matt' },
	pane: { token: '--paper', finish: 'glas-klar' },
	access: metal(flowToken.people),
	living: { token: ACCENT_TOKEN.living, finish: 'metall-lackiert' },
	energy: metal(ACCENT_TOKEN.energy),
	water: metal(ACCENT_TOKEN.water),
	food: metal(ACCENT_TOKEN.food),
	material: metal(ACCENT_TOKEN.material)
};
