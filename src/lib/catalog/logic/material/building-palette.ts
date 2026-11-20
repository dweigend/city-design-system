import { hashUnit } from '../../core/random';
import { ACCENT_TOKEN, GROUND_TOKEN, type HouseUse } from '../../data/house-body';
import type { BuildingSurface, ColorToken, FinishId } from '../parametrik/types';

type Surface = { token: ColorToken; finish: FinishId };
const surface = (token: ColorToken, finish: FinishId): Surface => ({ token, finish });

// One field colour for each ensemble. Housing can take a mineral, ceramic or folded-metal family;
// service buildings retain their programme hue across those three treatments.
const shellFinishes = ['keramik-glasiert', 'corrugated-metal', 'beton-terrazzo'] as const;
/** Assigns the building's named material slots in theme tokens. The stable ensemble key owns the draw. */
export function buildingPalette(use: HouseUse, ensemble: string) {
	const family = Math.floor(hashUnit(0, ensemble, 'building-material') * shellFinishes.length);
	const ground = (finish: FinishId) => ({
		...surface(GROUND_TOKEN[use], finish),
		colourRole: 'ensemble-ground' as const
	});
	return {
		shell: ground(shellFinishes[family]),
		base: ground('beton-terrazzo'),
		deck: ground('beton-terrazzo'),
		screen: ground('perforated-metal'),
		pane: surface('--paper', 'acryl-matt'),
		fitting: surface('--ink-3', 'metall-gebuerstet'),
		frame: surface('--ink-3', 'metall-lackiert')
	};
}

/** Resolves a construction slot and its optional occupied-body accent before scene overrides. */
export function resolveBuildingSurface(context: BuildingSurface) {
	const stock = buildingPalette(context.use, context.ensemble)[context.slot];
	if (!context.accentUse) return stock;
	return { ...stock, token: ACCENT_TOKEN[context.accentUse], colourRole: 'body-accent' as const };
}
