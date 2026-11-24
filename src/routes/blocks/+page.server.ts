import { buildModuleCatalogue } from '../../../scripts/module-catalogue';
import { designPrinciples } from '../design-principles';

const files = import.meta.glob<string>(
	[
		'/src/lib/{core,domain,world,scene,ui}/**/*.{ts,svelte,md}',
		'/src/config/**/*.ts',
		'/docs/standards/ARCHITECTURE.md'
	],
	{ query: '?raw', import: 'default', eager: true }
);

export const prerender = true;

/** Reads the module catalogue from the same source files as the command-line check. */
export function load() {
	const sources = Object.fromEntries(
		Object.entries(files).map(([path, source]) => [path.slice(1), source])
	);
	return {
		catalogue: buildModuleCatalogue(sources, new Set(designPrinciples.map(({ id }) => id)))
	};
}
