import type { Palette3D } from '../data/city3d';

import { surfaceTokens } from '../logic/parametrik/types';

/** Resolves a CSS scene token. Missing categories default to paper and a missing signal to ink. */
export function sceneSwatch(palette: Palette3D, token: string, fallback = palette.paper): string {
	switch (token) {
		case '--paper':
			return palette.paper;
		case '--ink':
			return palette.ink;
		case '--ink-3':
			return palette.ink3 ?? fallback;
		case '--blueprint':
			return palette.blueprint;
		case '--signal':
			return palette.categories[token] ?? palette.ink;
		default:
			return palette.categories[token.replace('--cat-', '')] ?? fallback;
	}
}

/** Builds the scene palette from CSS tokens resolved together in one theme context. */
export function scenePalette(resolve: (names: string[]) => Record<string, string>): Palette3D {
	const names = [
		...surfaceTokens,
		'--ink-3',
		'--blueprint-soft',
		'--terrain-soil',
		'--cat-health-1',
		'--cat-health-2'
	];
	const t = resolve(names);
	return {
		paper: t['--paper'],
		ink: t['--ink'],
		ink3: t['--ink-3'],
		terrainSoil: t['--terrain-soil'],
		blueprint: t['--blueprint'],
		blueprintSoft: t['--blueprint-soft'],
		categories: Object.fromEntries(
			names
				.filter(
					(n) =>
						n.startsWith('--ground-') ||
						n.startsWith('--cat-') ||
						n === '--body-living' ||
						n === '--signal'
				)
				.map((n) => [n.replace('--cat-', ''), t[n]])
		)
	};
}
