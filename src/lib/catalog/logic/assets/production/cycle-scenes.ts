import { mount, type AssetRecipe } from '../definition';
import { cycleRide } from './cycle-ride';
import { figureSurfaces } from './public-life';
import { actionFigure } from './activities/action-figure';
function scene(id: string, footprint: [number, number], child: boolean): AssetRecipe {
	return {
		id,
		footprint,
		category: 'cycling-life',
		anchors: [mount('deck')],
		slotNames: ['skin', 'coat', 'gear'],
		suggestions: figureSurfaces,
		variants: ['left-pedal', 'rising-pedal', 'right-pedal'],
		draw(v, s) {
			return [
				...cycleRide(false, -0.45, -0.48, v, s),
				...actionFigure('stand', [-0.65, 0.48, 0], { sample: 1 - s, heading: 0.68 }),
				...actionFigure(v === 1 ? 'stand' : 'walk', [0.54, 0.6, 0], {
					sample: s,
					child,
					heading: -0.85,
					phase: v
				})
			];
		}
	};
}
export const cycleScenes = [
	scene('family-cycle-lesson', [4, 3.25], true),
	scene('market-delivery-pair', [5, 3.75], false),
	scene('school-cycle-train', [6, 4], true),
	scene('riverside-cycle-club', [6.5, 4.5], false),
	scene('bakery-cycle-delivery', [4.5, 3.25], false)
];
