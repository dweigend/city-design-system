import { drum } from '../parts';
import { series } from './series';
import { treeCrown, type TreeForm } from './tree-crown';
type Crown =
	| 'pollard'
	| 'terraced-cedar'
	| 'table-pine'
	| 'column-hornbeam'
	| 'cube-linden'
	| 'fan-pear'
	| 'coppice';
const tree = series(
	'park-specimens',
	'deck',
	[2.5, 3.75, 5],
	['low-crown', 'street-crown', 'park-crown']
);
const forms: Record<Crown, TreeForm> = {
	pollard: 'clumps',
	'terraced-cedar': 'folds',
	'table-pine': 'blocks',
	'column-hornbeam': 'folds',
	'cube-linden': 'blocks',
	'fan-pear': 'blocks',
	coppice: 'clumps'
};
function specimen(type: Crown) {
	return tree(
		type + '-park-tree',
		['foot', 'slats', 'planting'],
		(w) => w,
		(w, v, s) => [
			drum([0, 0, 0], w * 0.19, 0.12, 'foot'),
			...treeCrown(forms[type], [0, 0, 0.12], w * (0.36 + v * 0.024), v, s, 'slats')
		]
	);
}
export const parkTrees = (
	[
		'pollard',
		'terraced-cedar',
		'table-pine',
		'column-hornbeam',
		'cube-linden',
		'fan-pear',
		'coppice'
	] as const
).flatMap(specimen);
