import type { Palette3D } from '../data/city3d';

import type { ColorToken } from '../logic/parametrik/types';

/** Resolves a primitive pigment to its theme swatch for both material shaders and the form lab. */
export function sceneSwatch(palette: Palette3D, token: ColorToken) {
	switch (token) {
		case '--paper':
			return palette.paper;
		case '--ink':
			return palette.ink;
		case '--blueprint':
			return palette.blueprint;
		case '--signal':
			return palette.categories[token] ?? palette.ink;
		default:
			return palette.categories[token.replace('--cat-', '')] ?? palette.paper;
	}
}

const CATEGORIES = [
	'living',
	'health',
	'mobility',
	'business',
	'nature',
	'hazard',
	'health-1',
	'health-2',
	'health-3',
	'health-5',
	'business-3',
	'business-2',
	'nature-2'
];

/** Builds the scene palette from CSS tokens resolved together in one theme context. */
export function scenePalette(resolve: (names: string[]) => Record<string, string>): Palette3D {
	const names = [
		'paper',
		'ink',
		'ink-3',
		'blueprint',
		'blueprint-soft',
		'body-living',
		'signal',
		...CATEGORIES.map((c) => `cat-${c}`)
	];
	const t = resolve(names.map((n) => `--${n}`));
	const token = (name: string) => t[`--${name}`];
	return {
		paper: token('paper'),
		ink: token('ink'),
		ink3: token('ink-3'),
		blueprint: token('blueprint'),
		blueprintSoft: token('blueprint-soft'),
		categories: {
			...Object.fromEntries(CATEGORIES.map((name) => [name, token(`cat-${name}`)])),
			'--body-living': token('body-living'),
			'--signal': token('signal')
		}
	};
}
