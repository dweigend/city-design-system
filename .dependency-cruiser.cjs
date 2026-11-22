// Import matrix of docs/standards/ARCHITECTURE.md (A-20 to A-28).
// Existing findings are frozen in .dependency-cruiser-baseline.json.
const corePath = 'src/lib/catalog/core/';
const runtimeFile = '(?!.*\\.test\\.ts$)(?!benchmark\\.ts$)(?!.*/benchmark\\.ts$)';
// List approved npm packages here by their resolved node_modules paths.
const coreTargets = [`${corePath}(?!.*\\.svelte(?:\\.[jt]s)?$)`].join('|');
//
// Layer membership: tests and benchmarks are `dev` everywhere; `*.svelte` and `*.svelte.ts` are
// `component`. Folder rules for data/ and logic/ still apply to a Svelte file placed there, so a
// component cannot escape the headless gate by living in a headless folder.
const DEV = '(\\.test\\.ts|(^|/)benchmark\\.ts)$';
const COMPONENT = '\\.svelte(\\.ts)?$';
const NOT_DEV_OR_COMPONENT = `(${DEV}|${COMPONENT})`;

/** Package identity before (bare specifier) and after (node_modules path) resolution. */
const pkg = (names) => `(^(${names})($|/)|(^|/)node_modules/(@types/)?(${names})/)`;
const SVELTE = pkg('svelte');
const SVELTEKIT_APP = '^\\$app($|/)';
const UI_KIT = pkg('bits-ui|lucide-svelte');
const THREE = pkg('three');
const SCENE = '^src/lib/catalog/scene/';
const ROUTE = '^src/routes/';
const UI = [SVELTE, SVELTEKIT_APP, UI_KIT, COMPONENT, ROUTE].join('|');
// Headless layers keep these out (A-20 to A-23); scene is matched as a folder, its Svelte hosts too.
const HEADLESS_FORBIDDEN = [UI, THREE, SCENE].join('|');

const headless = { path: '^src/lib/catalog/(data|logic)/', pathNot: DEV };
const scene = { path: SCENE, pathNot: NOT_DEV_OR_COMPONENT };

module.exports = {
	forbidden: [
		{
			name: 'headless-core',
			comment: 'A-20 to A-23: data/ and logic/ reach no UI, route, scene, Svelte or three.js.',
			severity: 'error',
			from: headless,
			to: { path: HEADLESS_FORBIDDEN, reachable: true }
		},
		{
			name: 'core-no-higher-layers',
			severity: 'error',
			from: { path: `^${corePath}(?!.*\\.test\\.ts$)` },
			to: { path: `^(?!(?:${coreTargets}))` }
		},
		{
			name: 'core-test-allowed-imports',
			severity: 'error',
			from: { path: `^${corePath}.*\\.test\\.ts$` },
			to: { path: `^(?!(?:${coreTargets}|bun:test$))` }
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
			name: 'city-plan-public-entry',
			comment: 'A-30: consumers and contract tests import the city plan through its barrel.',
			severity: 'error',
			from: {
				path: '^(?:(?!src/lib/catalog/logic/city-plan/)|src/lib/catalog/logic/city-plan/(?!.*\\.unit\\.test\\.ts$).*\\.test\\.ts$)'
			},
			to: { path: '^src/lib/catalog/logic/city-plan/(?!index\\.ts$)' }
		},
		{
			name: 'data-no-logic',
			comment: 'A-20: data/ holds facts only and never reaches logic/.',
			severity: 'error',
			from: { path: '^src/lib/catalog/data/', pathNot: DEV },
			to: { path: '^src/lib/catalog/logic/', reachable: true }
		},
		{
			name: 'scene-no-ui',
			comment: 'A-24: scene/ projects to three.js and imports no component, route or UI package.',
			severity: 'error',
			from: scene,
			// Direct edges only. The transitive variant (`reachable: true`) stays off until
			// scene/themeBinding.ts stops reaching the theme/ component barrel (refactor A03).
			to: { path: UI }
		},
		{
			name: 'component-no-three',
			comment: 'A-25: components render three.js only through scene/.',
			severity: 'error',
			// Direct only: component -> scene -> three is the sanctioned path, so reachability
			// cannot express A-25. Same for route-thin, whose components legally reach every layer.
			from: { path: `^src/lib/catalog/.*${COMPONENT}`, pathNot: DEV },
			to: { path: THREE }
		},
		{
			name: 'route-thin',
			comment: 'A-26: a route mounts a page component and imports no layer below it.',
			severity: 'error',
			from: { path: ROUTE, pathNot: DEV },
			to: {
				path: [`^src/lib/catalog/(data|logic|scene)/`, UI_KIT, THREE].join('|'),
				pathNot: `^src/lib/catalog/scene/.*${COMPONENT}`
			}
		},
		{
			name: 'no-runtime-to-dev',
			comment: 'A-27: no runtime file imports a test or benchmark.',
			severity: 'error',
			from: { pathNot: DEV },
			to: { path: DEV }
		},
		{ name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } }
	],
	options: {
		// Keep incoming edges visible to the rules while skipping traversal of these folders.
		doNotFollow: { path: '((^|/)node_modules/|^(\\.svelte-kit|build|static|docs)/)' },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: { extensions: ['.ts', '.js', '.svelte'] }
	}
};
