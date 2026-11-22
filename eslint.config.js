import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

/**
 * Runtime code that `tsconfig.json` covers. Tests and scripts use
 * `tsconfig.bun.json` and are linted without types.
 */
const typedFiles = ['src/**/*.ts', 'src/**/*.svelte'];
const untypedFiles = ['src/**/*.test.ts'];

/**
 * Type-aware rules from `recommendedTypeChecked` that still have findings. Measured counts and
 * the follow-up live in the typed-lint report; switch one on only after its findings are fixed.
 */
const deferredTypeChecked = /** @type {const} */ ({
	'@typescript-eslint/no-floating-promises': 'off',
	'@typescript-eslint/no-unsafe-argument': 'off',
	'@typescript-eslint/no-unsafe-assignment': 'off',
	'@typescript-eslint/no-unsafe-call': 'off',
	'@typescript-eslint/no-unsafe-member-access': 'off',
	'@typescript-eslint/no-unsafe-return': 'off',
	'@typescript-eslint/no-unnecessary-type-assertion': 'off'
});

/** Type-aware rules of `recommendedTypeChecked`, applied only to `typedFiles`. */
const typeCheckedRules = Object.fromEntries(
	ts.configs.recommendedTypeCheckedOnly
		.flatMap((config) => Object.entries(config.rules ?? {}))
		.filter(([name]) => name.startsWith('@typescript-eslint/'))
);

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: typedFiles,
		ignores: untypedFiles,
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				tsconfigRootDir: import.meta.dirname
			}
		},
		rules: {
			...typeCheckedRules,
			...deferredTypeChecked,
			// A `default` branch counts as handled; switches without one must cover every variant (C-21).
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true }
			]
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			complexity: ['warn', 10],
			'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }]
		}
	},
	{
		files: ['src/routes/**/*.svelte'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{ selector: 'SvelteStyleElement', message: 'Route CSS belongs in src/app.css.' },
				{
					selector: 'SvelteAttribute[key.name="style"]',
					message: 'Route style attributes are forbidden.'
				},
				{
					selector: 'SvelteStyleDirective',
					message: 'Route style directives are forbidden.'
				}
			]
		}
	}
);
