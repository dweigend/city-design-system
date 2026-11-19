import { cap } from '../parts';
import { panel } from '../objects/forms';
import { suggestions } from '../objects/suggestions';
import { actionFigure } from './activities/action-figure';
import type { ObjectGeometry } from '../object-geometry';
import { series } from './series';

const plaza = series(
	'occupied-decks',
	'deck',
	[5, 7.5, 10],
	['neighbours', 'small-party', 'crowd'],
	'body'
);
type Place = 'reading' | 'stop' | 'skate' | 'work' | 'play' | 'lookout' | 'market';

function furniture(place: Place, w: number): ObjectGeometry[] {
	switch (place) {
		case 'reading':
			return [
				panel(-0.89, -1.04, 0, 0.88, 0.52, 0.33, 'frame'),
				panel(-0.89, -1.04, 0.33, 1.08, 0.66, 0.12, 'slats')
			];
		case 'stop':
			return [
				panel(-0.7, -w / 2 + 0.52, 0, 0.5, 0.55, 2.6, 'frame'),
				panel(-0.7, -w / 2 + 0.52, 2.4, 0.32, 0.82, 0.6, 'body'),
				panel(-0.92, 0, 0, 0.38, w - 0.45, 0.68, 'slats')
			];
		case 'skate':
			return [
				panel(-0.98, 0, 0, 0.58, w - 0.4, 0.27, 'slats'),
				panel(-1, 0, 0.27, 0.64, w - 0.32, 0.12, 'frame')
			];
		case 'work':
			return [
				panel(0.88, 0, 0.84, 1, w - 0.8, 0.18, 'slats'),
				...[-1, 1].map((s) => panel(0.88, s * w * 0.31, 0, 0.88, 0.32, 0.84, 'frame'))
			];
		case 'play':
			return [
				panel(0.92, 0, 0, 1, w - 0.5, 0.25, 'slats'),
				...[-1, 1].map((s) => cap([0.92, s * w * 0.25, 0.25], 0.44, 0.55, 'frame'))
			];
		case 'lookout':
			return [0, 1, 2].flatMap((i) => {
				const tread = (w - 0.3) / 3,
					x = (i - 1) * tread;
				return [
					panel(x, 0, 0, tread + 0.015, w - 0.16, 0.19 * (i + 1), 'slats'),
					panel(x, w / 2 - 0.24, 0.19 * (i + 1), tread, 0.31, 0.32, 'frame')
				];
			});
		case 'market':
			return [
				panel(0.9, 0, 0, 0.68, w * 0.49, 0.73, 'frame'),
				panel(0.9, 0, 0.73, 0.82, w * 0.52, 0.13, 'slats')
			];
	}
}
// Three conversation circles use different axes. The intervening walkers have clear passage.
const positions = [
	[-0.89, -1.04, 0.55],
	[-1.66, -1.18, 0.2],
	[-1.35, -1.92, 1.55],
	[1.05, 1.06, 2.3],
	[1.76, 1.47, 3.5],
	[1.09, 1.92, 4.8],
	[-1.2, 1.25, -0.7],
	[-1.88, 0.91, 0.3],
	[-1.77, 1.88, 4.95],
	[0.04, -0.35, 0.92],
	[0.66, -1.67, -2.7],
	[-0.22, -1.68, 0.2],
	[0.77, -0.78, 4.55],
	[2.05, 0.58, 2.51],
	[-0.12, 0.94, -0.41]
];
function scene(place: Place) {
	const recipes = plaza(
		place + '-public-deck',
		['frame', 'slats', 'body'],
		(w) => w,
		(w, v, s) => {
			const n = w >= 7.5 ? 5 : 3;
			const crowd = positions.slice(0, (v + 1) * n).flatMap(([x, y, heading], i) => {
				const stair = place === 'lookout',
					step = Math.min(2, Math.max(0, Math.floor(x / ((w - 0.3) / 3) + 1.5)));
				const pose =
					place === 'reading' && i === 0
						? 'sit'
						: i % 4 === 1
							? stair
								? 'climb'
								: 'walk'
							: 'stand';
				return actionFigure(pose, [x, y, stair ? (step + 1) * 0.19 : 0], {
					slot: 'body',
					heading,
					child: place === 'play' && i % 5 === 1,
					sample: (s + i * 0.39) % 1
				});
			});
			return [...furniture(place, w), ...crowd];
		}
	);
	if (place === 'market' || place === 'work') {
		return recipes.map((recipe) => ({
			...recipe,
			suggestions: { ...recipe.suggestions, frame: suggestions.slats }
		}));
	}
	return recipes;
}
export const occupiedDecks = (
	['reading', 'stop', 'skate', 'work', 'play', 'lookout', 'market'] as const
).flatMap(scene);
