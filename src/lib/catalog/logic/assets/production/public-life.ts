import { mount, type AssetRecipe, type AssetSurface } from '../definition';
import { actionFigure } from './activities/action-figure';
import type { Action } from './activities/props';
import { craft } from './activities/craft';
import { music } from './activities/music';
import { ride } from './activities/ride';
import { field } from './activities/field';
const surfaces = {
	skin: { finish: 'holz-natur', material: 'wood', token: '--cat-living' },
	coat: { finish: 'membran-gewebe', material: 'membrane', token: '--body-living' },
	gear: { finish: 'metall-graphit', material: 'metal', token: '--blueprint' }
} satisfies Record<string, AssetSurface>;
function character(type: string, variants: string[], pose: (v: number) => Action): AssetRecipe {
	return {
		id: type === 'scooter' ? 'kick-scooter-child' : 'plaza-' + type,
		category: 'public-life',
		footprint: type === 'bowler' ? [3.25, 1.75] : [2.75, 1.75],
		anchors: [mount('deck')],
		slotNames: ['skin', 'coat', 'gear'],
		variants,
		suggestions: surfaces,
		draw(v) {
			const a = pose(v);
			return [...actionFigure(a.pose, type === 'scooter'), ...a.props];
		}
	};
}
export const publicLife = [
	character('gardener', ['loosen', 'plant', 'pat'], (v) => craft('gardener', v)),
	character('potter', ['open', 'raise', 'shape'], (v) => craft('potter', v)),
	character('painter', ['low-stroke', 'mid-stroke', 'high-stroke'], (v) => craft('painter', v)),
	character('drummer', ['left-beat', 'cross-beat', 'right-beat'], (v) => music('drummer', v)),
	character('cellist', ['down-bow', 'mid-bow', 'up-bow'], (v) => music('cellist', v)),
	character('skater', ['coast', 'carve', 'crouch'], (v) => ride('skater', v)),
	character('scooter', ['plant-foot', 'push-off', 'coast'], (v) => ride('scooter', v)),
	character('porter', ['carry', 'balance', 'lift'], (v) => field('porter', v)),
	character('bowler', ['release', 'swing', 'draw-back'], (v) => field('bowler', v)),
	character('photographer', ['kneel', 'brace', 'stand'], (v) => field('photographer', v))
];
