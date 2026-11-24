import type { Drawable } from '../surface';
import { projectSketch } from './index';

/** Sketches one 4 m cube standing on the ground. */
export function example() {
	const cube: Drawable = {
		id: 'cube',
		shape: { kind: 'box', center: [0, 0, 2], size: [4, 4, 4], rotation: 0 },
		color: '--model-white',
		finish: 'matte'
	};
	return projectSketch([cube], { marginRatio: 0, decimals: 2 });
}
