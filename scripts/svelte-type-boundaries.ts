import { readFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

import type { GraphModule, TypeEdge } from './svelte-type-boundaries.rules';

/** Read explicit type dependencies from both Svelte script contexts, never markup/comments. */
export function typeSpecifiers(source: string): string[] {
	const ast = parse(source, { modern: true });
	const specifiers = new Set<string>();
	for (const script of [ast.instance, ast.module]) {
		if (!script) continue;
		// Svelte parses scripts with acorn, whose nodes carry source offsets the estree type omits.
		const { start, end } = script.content as typeof script.content & { start: number; end: number };
		const file = ts.createSourceFile(
			'component.ts',
			source.slice(start, end),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		);
		for (const statement of file.statements) {
			if (ts.isImportDeclaration(statement)) {
				const clause = statement.importClause;
				const bindings = clause?.namedBindings;
				if (
					clause?.isTypeOnly ||
					(bindings && ts.isNamedImports(bindings) && bindings.elements.some((e) => e.isTypeOnly))
				) {
					if (ts.isStringLiteral(statement.moduleSpecifier))
						specifiers.add(statement.moduleSpecifier.text);
				}
			} else if (ts.isExportDeclaration(statement)) {
				const clause = statement.exportClause;
				if (
					statement.isTypeOnly ||
					(clause && ts.isNamedExports(clause) && clause.elements.some((e) => e.isTypeOnly))
				) {
					if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
						specifiers.add(statement.moduleSpecifier.text);
					}
				}
			}
		}
	}
	return [...specifiers];
}

/** Use the resolver and TS-path plugin shipped with pinned dependency-cruiser. */
export function createTypeResolver(root: string, extensions: string[]) {
	const require = createRequire(import.meta.resolve('dependency-cruiser'));
	const enhancedResolve = require('enhanced-resolve');
	const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
	const resolver = enhancedResolve.create.sync({
		extensions,
		extensionAlias: { '.js': ['.ts', '.js'], '.mjs': ['.mts', '.mjs'], '.cjs': ['.cts', '.cjs'] },
		exportsFields: [],
		modules: ['node_modules', 'node_modules/@types'],
		plugins: [new TsconfigPathsPlugin({ configFile: resolve(root, 'tsconfig.json'), extensions })]
	});
	const configPath = resolve(root, 'tsconfig.json');
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error)
		throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
	if (parsed.errors.length)
		throw new Error(
			ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
				getCanonicalFileName: (f) => f,
				getCurrentDirectory: () => root,
				getNewLine: () => '\n'
			})
		);
	let ambientModules: string[] | undefined;
	function isAmbientModule(specifier: string): boolean {
		ambientModules ??= ts
			.createProgram(parsed.fileNames, parsed.options)
			.getTypeChecker()
			.getAmbientModules()
			.map((symbol) => JSON.parse(symbol.name) as string);
		return ambientModules.includes(specifier);
	}
	return (from: string, specifier: string): string => {
		if (isBuiltin(specifier)) return specifier;
		const typed = ts.resolveModuleName(
			specifier,
			resolve(root, from),
			parsed.options,
			ts.sys
		).resolvedModule;
		// External declarations can live in @types; retain the imported package identity
		// so the existing svelte/three path rules still see erased package imports.
		if (typed?.isExternalLibraryImport) return specifier;
		let target = typed?.resolvedFileName;
		if (!target) {
			try {
				target = resolver(resolve(root, dirname(from)), specifier);
			} catch (error) {
				// Wildcard declarations such as *.svelte must not hide local files or typos.
				if (!specifier.startsWith('.') && !specifier.startsWith('/') && isAmbientModule(specifier))
					return specifier;
				throw error;
			}
		}
		if (!target) throw new Error(`Cannot resolve type dependency ${from} -> ${specifier}`);
		return relative(root, target).split('\\').join('/');
	};
}

export function collectTypeEdges(
	modules: GraphModule[],
	root: string,
	resolveType: (from: string, specifier: string) => string
): TypeEdge[] {
	return modules
		.filter((m) => m.source.endsWith('.svelte'))
		.flatMap((m) =>
			typeSpecifiers(readFileSync(resolve(root, m.source), 'utf8')).map((specifier) => ({
				from: m.source,
				to: resolveType(m.source, specifier),
				specifier
			}))
		);
}

export {
	assertSupportedRules,
	checkTypeEdges,
	type GraphModule
} from './svelte-type-boundaries.rules';
