// Existing findings are frozen in .dependency-cruiser-baseline.json.
const corePath = 'src/lib/catalog/core/';
const runtimeFile = '(?!.*\\.test\\.ts$)(?!benchmark\\.ts$)(?!.*/benchmark\\.ts$)';

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
			name: 'core-no-higher-layers',
			severity: 'error',
			from: { path: `^${corePath}${runtimeFile}` },
			to: {
				path: '(^src/(?!lib/catalog/core/)|\\.svelte(?:\\.[jt]s)?$|(^|node_modules/)(svelte|three|bits-ui|lucide-svelte)(/|$)|^\\$app(/|$))'
			}
		},
		...['params', 'random'].flatMap((name) => {
			const modulePath = `${corePath}${name}/`;
			return [
				{
					name: `core-${name}-independent`,
					severity: 'error',
					from: { path: `^${modulePath}${runtimeFile}` },
					to: { path: `^${corePath}(?!${name}/)` }
				},
				{
					name: `core-${name}-public-entry`,
					severity: 'error',
					from: {
						// Public contract tests count as external consumers, even inside the module.
						path: `^(?:(?!${modulePath})|${modulePath}(?!.*\\.unit\\.test\\.ts$).*\\.test\\.ts$)`
					},
					to: { path: `^${modulePath}(?!index\\.ts$)` }
				}
			];
		}),
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
