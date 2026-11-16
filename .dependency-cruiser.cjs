// Existing findings: see docs/standards/herleitung/tooling-baseline.md and 103 step 2.
module.exports = {
	forbidden: [
		{
			name: 'headless-core',
			severity: 'error',
			// Tests belong to dev regardless of their directory.
			from: { path: '^src/lib/catalog/(data|logic)/(?!.*\\.test\\.ts$)' },
			to: {
				path: '(^svelte($|/)|^three($|/)|node_modules/(svelte|three)/|^src/lib/catalog/scene/|\\.svelte$)'
			}
		},
		{
			name: 'data-no-logic',
			severity: 'error',
			from: { path: '^src/lib/catalog/data/(?!.*\\.test\\.ts$)' },
			to: { path: '^src/lib/catalog/logic/' }
		},
		{
			name: 'no-runtime-to-dev',
			severity: 'error',
			from: { path: '^(?!.*\\.test\\.ts$)(?!benchmark\\.ts$)(?!.*/benchmark\\.ts$)' },
			to: { path: '(\\.test\\.ts$|(^|/)benchmark\\.ts$)' }
		},
		{ name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } }
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: { extensions: ['.ts', '.js', '.svelte'] },
		exclude: '^(.svelte-kit|build|static|docs)/'
	}
};
