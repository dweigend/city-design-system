import { mount, type AssetRecipe } from './definition';
import { drum, bulb, rod, ring } from './parts';

export const twoSuns: AssetRecipe = {
	id: 'two-suns',
	slotNames: ['body', 'edge', 'highlight', 'channel'],
	category: 'landmarks',
	variants: ['courtyard', 'roof-beacon', 'civic-mast'],
	footprint: [7, 8.5],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const s = [0.76, 1, 1.48][variant],
			reach = (0.86 + 0.08 * sample) * s;
		return [
			drum([0, 0, 0], 0.82 * s, 0.26 * s),
			drum([0, 0, 0.26 * s], 0.115 * s, 5.56 * s, 'edge'),
			bulb([0, 0, 5.83 * s], 0.22 * s, 1, 'body'),
			rod([0, 0, 3.9 * s], [0, -reach, 3.9 * s], 0.08 * s),
			ring([0, -reach, 3.9 * s], 1.57 * s, 0, 0.16 * s, 'highlight'),
			rod([0, 0, 4.9 * s], [0.22 * s, reach, 4.9 * s], 0.08 * s),
			ring([0.22 * s, reach, 4.9 * s], 0.94 * s, 0, 0.15 * s, 'channel')
		];
	}
};
