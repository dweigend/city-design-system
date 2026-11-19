import type { Palette3D } from '../data/city3d';

import { surfaceTokens, type ColorToken } from '../logic/parametrik/types';

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

/** Builds the scene palette from CSS tokens resolved together in one theme context. */
export function scenePalette(resolve: (names: string[]) => Record<string, string>): Palette3D {
	const names = [
		...surfaceTokens,
		'--ink-3',
		'--blueprint-soft',
		'--cat-health-1',
		'--cat-health-2'
	];
	const t = resolve(names);
	return {
		paper: t['--paper'],
		ink: t['--ink'],
		ink3: t['--ink-3'],
		blueprint: t['--blueprint'],
		blueprintSoft: t['--blueprint-soft'],
		categories: Object.fromEntries(
			names
				.filter((n) => n.startsWith('--cat-') || n === '--body-living' || n === '--signal')
				.map((n) => [n.replace('--cat-', ''), t[n]])
		)
	};
}
