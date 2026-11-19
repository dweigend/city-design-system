import { mount, type AssetRecipe } from '../definition';
import { suggestions } from '../objects/suggestions';
import { panel } from '../objects/forms';
import { cap } from '../parts';
import type { ObjectGeometry } from '../object-geometry';
import { cycleRide } from './cycle-ride';

const dress = { skin: suggestions.slats, coat: suggestions.body, gear: suggestions.frame };
function scene(
	id: string,
	footprint: [number, number],
	draw: (v: number) => ObjectGeometry[]
): AssetRecipe {
	return {
		id,
		footprint,
		category: 'cycling-life',
		anchors: [mount('deck')],
		slotNames: ['skin', 'coat', 'gear'],
		suggestions: dress,
		variants: ['left-pedal', 'rising-pedal', 'right-pedal'],
		draw
	};
}
export const cycleScenes = [
	scene('family-cycle-lesson', [4, 3.25], (v) => [
		...cycleRide('road', -0.34, -0.66, v),
		...cycleRide('junior', 0.39, 0.66, (v + 1) % 3)
	]),
	scene('market-delivery-pair', [5, 3.75], (v) => [
		...cycleRide('freight', -0.42, -0.66, v),
		...cycleRide('road', 0.54, 0.68, (v + 2) % 3),
		...[-1, 1].map((t) => cap([0.28, -0.66 + t * 0.17, 0.93], 0.17, 0.24, 'coat'))
	]),
	scene('school-cycle-train', [6, 4], (v) => [
		...cycleRide('road', 1.43, -0.32, v),
		...cycleRide('junior', -0.62, 0.75, (v + 1) % 3),
		...cycleRide('junior', -1.54, -0.67, (v + 2) % 3)
	]),
	scene('riverside-cycle-club', [6.5, 4.5], (v) => [
		...cycleRide('road', 1.48, 0.55, v),
		...cycleRide('road', -0.42, -0.66, (v + 1) % 3),
		...cycleRide('road', -1.62, 0.65, (v + 2) % 3),
		panel(0, -1.65, 0, 5.8, 0.38, 0.46, 'skin')
	]),
	scene('bakery-cycle-delivery', [4.5, 3.25], (v) => [
		...cycleRide('freight', 0, -0.48, v),
		panel(-0.15, 0.92, 0, 2.5, 0.63, 0.94, 'skin'),
		...[-1, 0, 1].map((t) => cap([t * 0.73 - 0.15, 0.92, 0.94], 0.27, 0.18, 'coat'))
	])
];
