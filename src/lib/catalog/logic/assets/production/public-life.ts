import { mount, type AssetRecipe } from '../definition';
import { panel } from '../objects/forms';
import { actionFigure, clay, type Pose } from './activities/action-figure';
const propSurface = { material: 'concrete', finish: 'beton-schalung', token: '--ink' } as const;
export const figureSurfaces = { coat: clay, skin: propSurface, gear: propSurface };
function character(id: string, variants: string[], poses: Pose[]): AssetRecipe {
	return {
		id,
		category: 'public-life',
		variants,
		anchors: [mount('deck')],
		footprint: id === 'plaza-bowler' ? [3.25, 1.75] : [2.75, 1.75],
		slotNames: ['skin', 'coat', 'gear'],
		suggestions: figureSurfaces,
		draw(v, s) {
			const pose = poses[v];
			return [
				...actionFigure(pose, [0, 0, 0], {
					sample: s,
					child: id === 'kick-scooter-child',
					heading: (v - 1) * 0.26,
					phase: v
				}),
				...(pose === 'carry' ? [panel(0.27, 0, 0.83, 0.21, 0.28, 0.24, 'skin')] : []),
				...(pose === 'sit'
					? [panel(0, 0, 0, 0.3, 0.32, 0.34, 'gear'), panel(0, 0, 0.34, 0.38, 0.4, 0.11, 'skin')]
					: [])
			];
		}
	};
}
export const publicLife = [
	character('plaza-gardener', ['loosen', 'plant', 'pat'], ['stand', 'sit', 'carry']),
	character('plaza-potter', ['open', 'raise', 'shape'], ['sit', 'stand', 'carry']),
	character('plaza-painter', ['low-stroke', 'mid-stroke', 'high-stroke'], ['stand', 'walk', 'sit']),
	character('plaza-drummer', ['left-beat', 'cross-beat', 'right-beat'], ['sit', 'stand', 'sit']),
	character('plaza-cellist', ['down-bow', 'mid-bow', 'up-bow'], ['sit', 'stand', 'sit']),
	character('plaza-skater', ['coast', 'carve', 'crouch'], ['walk', 'stand', 'sit']),
	character('kick-scooter-child', ['plant-foot', 'push-off', 'coast'], ['stand', 'walk', 'sit']),
	character('plaza-porter', ['carry', 'balance', 'lift'], ['carry', 'walk', 'sit']),
	character('plaza-bowler', ['release', 'swing', 'draw-back'], ['walk', 'stand', 'sit']),
	character('plaza-photographer', ['kneel', 'brace', 'stand'], ['sit', 'lean', 'stand'])
];
