import { noTunableNumber } from './scripts/config/no-tunable-number.js';
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

/** @param {string} selector @param {string} message */
const forbid = (selector, message) => ({ selector, message });
const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');
const code = '{js,mjs,cjs,ts,mts,cts,jsx,tsx}';
const headlessLayers = 'src/lib/{core,domain,world}';
const headless = [`${headlessLayers}/**/*.${code}`, `${headlessLayers}/**/*.svelte`];
const library = 'src/lib/{core,domain,world,scene,ui}';
const invalidLibraryPath = forbid(
	'Program',
	'Keep library files in a flat module directly under a layer.'
);
const kitPath = 'src/lib/ui/**';
const stagePath = 'src/lib/scene/stage/**';

const namedExports = forbid('ExportAllDeclaration', 'Export each public name explicitly.');
const color = '/#(?:[\\da-f]{8}|[\\da-f]{6}|[\\da-f]{4}|[\\da-f]{3})\\b|(?:rgb|hsl)a?\\(|^--/i';
const colorValues = 'Use a slot name in headless geometry.';
const styles = [
	forbid('SvelteStyleElement', 'Put styles in src/app.css.'),
	forbid(
		'SvelteAttribute[key.name=/^style$/i], SvelteShorthandAttribute[key.name="style"]',
		'Use a class instead of a style attribute.'
	),
	forbid('SvelteStyleDirective', 'Use a class instead of a style directive.')
];
const kitPackage = '/^(bits-ui|lucide-svelte)(?:\\/|$)/';
const kit = forbid(
	[
		`:matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression, TSImportType, TSExternalModuleReference) Literal[value=${kitPackage}]`,
		`CallExpression[callee.name="require"] > Literal[value=${kitPackage}]`
	].join(', '),
	'Import Bits UI and Lucide only in src/lib/ui.'
);
const controls = forbid(
	'SvelteElement[kind="html"][name.name=/^(button|input|select|textarea)$/i]',
	'Use a control from src/lib/ui.'
);

/** @param {string} expression @param {string} names */
function namedCallee(expression, names) {
	const pattern = `/^(${names})$/`;
	return `${expression} > :matches(Identifier[name=${pattern}], MemberExpression[property.name=${pattern}], MemberExpression[property.value=${pattern}]).callee`;
}

/** Matches value acquisition as well as member calls, so local aliases cannot hide a constructor.
 * @param {string} names
 */
function threeConstructors(names) {
	const name = `/^(${names})$/`;
	const three = '/^three(?:\\x2f|$)/';
	return [
		`ImportDeclaration[source.value=${three}]:not([importKind="type"]) > ImportSpecifier:not([importKind="type"]):matches([imported.name=${name}], [imported.value=${name}])`,
		`ExportNamedDeclaration[source.value=${three}]:not([exportKind="type"]) > ExportSpecifier:not([exportKind="type"]):matches([local.name=${name}], [local.value=${name}])`,
		`MemberExpression:matches([property.name=${name}][computed=false], [property.value=${name}])`,
		`ObjectPattern > Property:matches([key.name=${name}][computed=false], [key.value=${name}])`
	].join(', ');
}

const palette = forbid(
	`Literal[value=${color}], TemplateElement[value.cooked=${color}], ${threeConstructors('Color')}`,
	colorValues
);
const stage = [
	forbid(
		threeConstructors('WebGPURenderer|WebGLRenderer|PerspectiveCamera|OrthographicCamera'),
		'Create renderers and cameras in src/lib/scene/stage.'
	),
	forbid(
		namedCallee('CallExpression', 'setAnimationLoop|requestAnimationFrame'),
		'Start frame loops in src/lib/scene/stage.'
	)
];

// Flat config replaces selector lists. Compose the restrictions for each source path.
const scopes = [
	{
		files: [`**/*.${code}`],
		ignores: [kitPath, stagePath, ...headless],
		rules: [namedExports, kit, ...stage]
	},
	{ files: [`${headlessLayers}/**/*.${code}`], rules: [namedExports, kit, ...stage, palette] },
	{ files: [`${kitPath}/*.${code}`], rules: [namedExports, ...stage] },
	{ files: [`${stagePath}/*.${code}`], rules: [namedExports, kit] },
	{
		files: ['**/*.svelte'],
		ignores: [kitPath, stagePath, ...headless],
		rules: [namedExports, kit, ...stage, ...styles, controls]
	},
	{
		files: [`${headlessLayers}/**/*.svelte`],
		rules: [namedExports, kit, ...stage, palette, ...styles, controls]
	},
	{ files: ['src/lib/ui/**/*.svelte'], rules: [namedExports, ...stage, ...styles] },
	{ files: ['src/lib/scene/stage/**/*.svelte'], rules: [namedExports, kit, ...styles, controls] }
];
/** @type {readonly string[]} Modules awaiting numeric settings migration. */
const pendingConfigModules = [];
/** @type {import('eslint').Linter.Config} */
const numericSettings = {
	files: [`${library}/**/*.${code}`, `${library}/**/*.svelte`],
	ignores: [
		...pendingConfigModules.map((module) => `src/lib/${module}/**`),
		'**/*.test.ts',
		'**/*.evidence.ts',
		'**/{example,*-example}.ts'
	],
	plugins: { config: { rules: { 'no-tunable-number': noTunableNumber } } },
	rules: { 'config/no-tunable-number': 'error' }
};

const typedRules = Object.fromEntries(
	ts.configs.recommendedTypeCheckedOnly
		.flatMap((config) => Object.entries(config.rules ?? {}))
		.filter(([name]) => name.startsWith('@typescript-eslint/'))
);
/** @param {ReturnType<typeof forbid>[]} selectors @returns {['error', ...ReturnType<typeof forbid>[]]} */
const restrict = (selectors) => ['error', ...selectors];

const restrictedSyntax = scopes.flatMap(({ rules, files, ignores = [] }) => [
	{ files, ignores, rules: { 'no-restricted-syntax': restrict(rules) } },
	{
		files: files.map((file) => [file, 'src/lib/**']),
		ignores: [...ignores, `${library}/*/*`],
		rules: { 'no-restricted-syntax': restrict([...rules, invalidLibraryPath]) }
	}
]);

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	globalIgnores(['scripts/fixtures/rules/']),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		linterOptions: { noInlineConfig: true },
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-non-null-assertion': 'error',
			complexity: ['warn', 10],
			'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['src/config/**/*.ts', 'scripts/config/*/**/*.ts'],
		rules: {
			'no-restricted-globals': [
				'error',
				{
					globals: ['window', 'document', 'navigator', 'process', 'Bun', 'fetch'],
					checkGlobalObject: true
				}
			]
		}
	},
	{
		files: headless,
		rules: {
			'no-restricted-globals': [
				'error',
				{
					globals: ['window', 'document', 'navigator', 'requestAnimationFrame'],
					checkGlobalObject: true
				}
			]
		}
	},
	{
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: ['src/**/*.test.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				tsconfigRootDir: import.meta.dirname
			}
		},
		rules: {
			...typedRules,
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true }
			]
		}
	},
	{
		files: ['src/**/*.svelte'],
		// Svelte-check validates template calls, including inferred snippet props.
		rules: { '@typescript-eslint/no-unsafe-call': 'off' }
	},
	numericSettings,
	...restrictedSyntax
);
