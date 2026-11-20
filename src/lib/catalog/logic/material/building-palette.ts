import { hashUnit } from '../../core/random';
import { BODY_TOKEN, type HouseUse } from '../../data/house-body';
import type { ColorToken, FinishId } from '../parametrik/types';

type Surface = { token: ColorToken; finish: FinishId };
const surface = (token: ColorToken, finish: FinishId): Surface => ({ token, finish });

// One field colour for each ensemble. Housing can take a mineral, ceramic or folded-metal family;
// service buildings retain their programme hue across those three treatments.
const shellFinishes = ['keramik-glasiert', 'corrugated-metal', 'beton-terrazzo'] as const;
const housingPigments = ['--cat-foliage', '--cat-health', '--cat-living'] as const;

/** Assigns the building's named material slots in theme tokens. The stable ensemble key owns the draw. */
export function buildingPalette(use: HouseUse, ensemble: string) {
	const family = Math.floor(hashUnit(0, ensemble, 'building-material') * shellFinishes.length);
	const pigment = use === 'living' ? housingPigments[family] : BODY_TOKEN[use];
	return {
		shell: { ...surface(pigment, shellFinishes[family]), colourRole: 'ensemble-ground' as const },
		base: surface('--paper', 'beton-terrazzo'),
		deck: surface('--paper', 'beton-terrazzo'),
		screen: surface(pigment, 'perforated-metal'),
		pane: surface('--cat-health-3', 'acryl-matt'),
		fitting: surface('--cat-mobility', 'metall-messing'),
		frame: surface('--ink-3', 'metall-lackiert')
	};
}
