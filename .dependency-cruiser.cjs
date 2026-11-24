const layers = {
	ui: ['ui'],
	scene: ['scene', 'world', 'domain', 'core'],
	world: ['world', 'domain', 'core'],
	domain: ['domain', 'core']
};
const configOwners = {
	'lib/domain/sandbox-document': 'sandbox-document',
	'lib/core/geometry': 'geometry',
	'lib/core/params': 'inputs',
	'lib/core/object': 'object',
	'lib/core/mesh': 'mesh',
	'lib/domain/movement-network': 'movement-network',
	'lib/domain/city-volume': 'city-volume',
	'lib/domain/cell-space': 'cell-space',
	'lib/domain/house-court': 'house-court',
	'lib/domain/river-metrics': 'river-metrics',
	'lib/domain/structure': 'structure',
	'lib/domain/valley': 'hydrology',
	'lib/world/city-site': 'lanes|parcels',
	'lib/world/house-site': 'house-site',
	'lib/domain/transit-line': 'transit-line',
	'lib/world/city-movement': 'city-movement',
	'lib/world/city-structure': 'city-structure',
	'lib/scene/paths-projection': 'paths-projection',
	'lib/scene/structure-projection': 'structure-projection',
	'lib/scene/stage': 'stage',
	'lib/domain/material': 'material',
	'lib/scene/material': 'material-drawing',
	'lib/scene/house-projection': 'house-projection',
	'lib/scene/sandbox-projection': 'sandbox-projection',
	'lib/scene/sandbox-interaction': 'sandbox-interaction',
	'routes/surfaces': 'surface-specimens',
	'routes/blocks': 'blocks-board',
	'routes/sandbox': 'sandbox-brush',
	'lib/world/valley-protocol': 'valley-measurement'
};
const allowedConfigEntries = Object.values(configOwners).join('|');
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
					pathNot: `^src/(?:lib/(?:${allowed.join('|')})/|routes/|app\\.css$|config/(?:${allowedConfigEntries})/index\\.ts$)`
				}
			)
		),
		error(
			'downward-only-core',
			{ path: '^src/lib/core/', pathNot: '\\.test\\.ts$' },
			{ pathNot: `^src/(?:lib/core/|config/(?:${allowedConfigEntries})/index\\.ts$)` }
		),
		error(
			'downward-only-core-test',
			{ path: '^src/lib/core/.*\\.test\\.ts$' },
			{ pathNot: `^(?:src/lib/core/|bun:test$|src/config/(?:${allowedConfigEntries})/index\\.ts$)` }
		),
		error(
			'config-owner-only',
			{
				path: '^src/',
				pathNot: `^src/(?:config/|(?:${Object.keys(configOwners).join('|')})/)`
			},
			{ path: '^src/config/' }
		),
		...Object.entries(configOwners).map(([owner, slice]) =>
			error(
				`config-owner-only-${slice.split('|')[0]}`,
				{ path: `^src/${owner}/` },
				{ path: '^src/config/', pathNot: `^src/config/(?:${slice})/index\\.ts$` }
			)
		),
		error(
			'config-helpers-data-only',
			{ path: '^src/config/[^/]+\\.ts$' },
			{ pathNot: '^src/config/setting\\.ts$' }
		),
		error(
			'config-data-only',
			{ path: '^src/config/([^/]+)/' },
			{ pathNot: '^src/config/(?:$1/|setting\\.ts$)' }
		),
		error(
			'script-config-data-only',
			{ path: '^scripts/config/([^/]+)/' },
			{ pathNot: '^(?:scripts/config/$1/|src/config/setting\\.ts$)' }
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
