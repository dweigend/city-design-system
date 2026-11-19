import { circle } from '../assembly';
import { treeCrown, type TreeForm } from './tree-crown';
import { roofStone } from './roof-stone';
import { panel } from '../objects/forms';
import { series } from './series';

type Plant = 'cube' | 'cone' | 'cloud' | 'umbrella' | 'cypress' | 'fork' | 'rock';
const garden = series('roof-groves', 'roof', [3.75, 5, 7.5], ['solitary', 'paired', 'grove']);
const forms: Record<Exclude<Plant, 'rock'>, TreeForm> = {
	cube: 'blocks',
	cone: 'folds',
	cloud: 'clumps',
	umbrella: 'blocks',
	cypress: 'folds',
	fork: 'clumps'
};
function grove(type: Plant) {
	return garden(
		type + '-roof-grove',
		type === 'rock' ? ['foot', 'planting'] : ['foot', 'slats', 'planting'],
		(w) => w,
		(w, v, s) => {
			const r = w * (v === 0 ? 0.33 : 0.2),
				n = v + 1,
				centres = n === 1 ? [[0, 0]] : circle(w * 0.23, n);
			if (type === 'rock')
				return [
					panel(0, 0, 0, w, w, 0.35, 'foot'),
					...centres.flatMap(([x, y], i) => [
						panel(x, y, 0.35, r * 1.95, r * 1.75, 0.12, 'planting'),
						roofStone(x, y, r, s + i * 1.4)
					])
				];
			return [
				panel(0, 0, 0, w, w, 0.35, 'foot'),
				panel(0, 0, 0.35, w - 0.32, w - 0.32, 0.22, 'planting'),
				...centres.flatMap(([x, y], i) =>
					treeCrown(forms[type], [x, y, 0.56], r, v, (s + i * 0.2) % 1, 'slats')
				)
			];
		}
	);
}
export const gardens = (
	['cube', 'cone', 'cloud', 'umbrella', 'cypress', 'fork', 'rock'] as const
).flatMap(grove);
