import { BODY_TOKEN, type HouseUse } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import type { AssetSurface } from '../assets';
import type { ColorToken } from '../parametrik/types';

export type Surface = AssetSurface;
export type SurfaceSlot = HouseUse | 'frame' | 'deck' | 'pane' | 'access' | 'shell';
export type HouseSurfaces = Readonly<Record<SurfaceSlot, Surface>>;

const metal = (token: ColorToken): Surface => ({ token, finish: 'metal', material: 'metal' });
/** Default assignments for the game and bible. Geometry accepts the same slots with any palette. */
export const houseSurfaces: HouseSurfaces = {
	frame: metal('--paper'),
	deck: metal('--paper'),
	shell: metal('--paper'),
	pane: { token: '--blueprint', finish: 'glas-klar', material: 'glass' },
	access: metal(flowToken.people),
	living: metal(BODY_TOKEN.living),
	energy: metal(BODY_TOKEN.energy),
	water: metal(BODY_TOKEN.water),
	food: metal(BODY_TOKEN.food),
	material: metal(BODY_TOKEN.material)
};
