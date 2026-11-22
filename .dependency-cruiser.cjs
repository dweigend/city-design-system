const layers = {
	ui: ['ui'],
	scene: ['scene', 'world', 'domain', 'core'],
	world: ['world', 'domain', 'core'],
	domain: ['domain', 'core']
};
const modulePath = 'src/lib/(?:ui|scene|world|domain|core)/[^/]+';
const headlessPackages = '(?:three|svelte|bits-ui|lucide-svelte)';
const installed = '(?:^|/)node_modules/';
const error = (name, from, to) => ({ name, severity: 'error', from, to });

module.exports = {
	forbidden: [
		...Object.entries(layers).map(([layer, allowed]) =>
			error(
				`downward-only-${layer}`,
				{ path: `^src/lib/${layer}/` },
				{
					dependencyTypes: ['local', 'localmodule'],
					pathNot: `^src/(?:lib/(?:${allowed.join('|')})/|routes/|app\\.css$)`
				}
			)
		),
		error(
			'downward-only-core',
			{ path: '^src/lib/core/', pathNot: '\\.test\\.ts$' },
			{ pathNot: '^src/lib/core/' }
		),
		error(
			'downward-only-core-test',
			{ path: '^src/lib/core/.*\\.test\\.ts$' },
			{ pathNot: '^(?:src/lib/core/|bun:test$)' }
		),
		error('no-file-cycles', {}, { circular: true }),
		{
			...error('no-module-cycles', { path: `^${modulePath}$` }, { circular: true }),
			scope: 'folder'
		},
		// $1 is the importer's module folder, as captured by the from pattern.
		error(
			'module-entry-only',
			{ path: `^(${modulePath})/` },
			{ path: `^${modulePath}/`, pathNot: `^(?:$1/|${modulePath}/index\\.ts$)` }
		),
		error(
			'module-entry-from-outside',
			{ pathNot: `^${modulePath}/` },
			{ path: `^${modulePath}/`, pathNot: `^${modulePath}/index\\.ts$` }
		),
		error(
			'headless-imports',
			{ path: '^src/lib/(core|domain|world)/' },
			{
				path: [
					`${installed}${headlessPackages}(?:/|$)`,
					`^${headlessPackages}(?:/|$)`,
					'^\\$app(?:/|$)',
					'(^|/)@sveltejs/kit/src/runtime/app/',
					'\\.svelte$'
				].join('|')
			}
		),
		error('app-css-only', { path: '^src/' }, { path: '\\.css$', pathNot: '^src/app\\.css$' }),
		error('routes-own-pages', { path: '^src/lib/' }, { path: '^src/routes/' }),
		error(
			'three-only-in-scene',
			{ pathNot: '^src/lib/scene/' },
			{ path: '^(?:three(?:/|$))|(?:^|/)node_modules/three(?:/|$)' }
		)
	],
	options: {
		exclude: '^scripts/fixtures/rules/',
		doNotFollow: { path: '(^|/)node_modules/' },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: { extensions: ['.ts', '.js', '.svelte'] }
	}
};
