import ts from 'typescript';
import { readsPublicResult } from './example-call';

type Sources = Readonly<Record<string, string>>;

/** Module metadata and any missing contract documentation. Paths are relative to the repository. */
export type ModuleRow = Readonly<{
	module: string;
	purpose: string | null;
	exports: readonly string[];
	exportDocumentation: Readonly<Record<string, string>>;
	example: string | null;
	exampleCall: string | null;
	exampleDemo: string | null;
	config: readonly string[];
	principles: readonly string[];
	errors: readonly string[];
}>;

const moduleEntry = /^(src\/lib\/(?:core|domain|world|scene|ui)\/[^/]+)\/index\.ts$/;
const exampleExemption =
	/^Modules under `(src\/lib\/[a-z/-]+)`[^\n]*demonstrated on the `(\/[a-z-]+)` page instead of carrying `contract\.test\.ts` and `example\.ts`\./gm;
const purposeLine = /^\/\*\* Module: ([^\n]+) \*\//;
const configImport = /['"](?:\.\.\/)+config\/([\w-]+)['"]/g;
const principleId = /\b[A-Z]+-\d+\b/g;

function bindingNames(name: ts.BindingName): string[] {
	if (ts.isIdentifier(name)) return [name.text];
	return name.elements.flatMap((element) =>
		ts.isBindingElement(element) ? bindingNames(element.name) : []
	);
}

function exportedNames(statement: ts.Statement): string[] {
	if (ts.isExportDeclaration(statement)) {
		const clause = statement.exportClause;
		if (!clause) return [];
		return ts.isNamedExports(clause)
			? clause.elements.map(({ name }) => name.text)
			: [clause.name.text];
	}
	if (!ts.canHaveModifiers(statement)) return [];
	if (!ts.getModifiers(statement)?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword))
		return [];
	if (ts.isVariableStatement(statement))
		return statement.declarationList.declarations.flatMap(({ name }) => bindingNames(name));
	if (ts.isDeclarationStatement(statement) && statement.name) return [statement.name.text];
	return [];
}

function jsdocSummary(node: ts.Node, source: ts.SourceFile) {
	const leading = source.text.slice(node.getFullStart(), node.getStart(source));
	const comment = Array.from(leading.matchAll(/\/\*\*([\s\S]*?)\*\//g)).at(-1)?.[1];
	const prose = comment?.replace(/^\s*\* ?/gm, '').trim();
	if (!prose || prose.startsWith('Module:') || prose.startsWith('@')) return undefined;
	const paragraph = prose.split(/\n\s*\n|\n\s*@/)[0].replace(/\s+/g, ' ');
	return paragraph.match(/^.*?[.!?](?=\s+[A-Z]|$)/)?.[0] ?? paragraph;
}

function collectExports(path: string, text: string) {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const exports = new Map<string, string | undefined>();
	for (const statement of source.statements) {
		const names = exportedNames(statement);
		const group = ts.isExportDeclaration(statement) ? statement.exportClause : undefined;
		for (const [index, name] of names.entries()) {
			const element = group && ts.isNamedExports(group) ? group.elements[index] : undefined;
			const summary =
				(element && jsdocSummary(element, source)) ??
				(names.length === 1 ? jsdocSummary(statement, source) : undefined);
			exports.set(name, exports.get(name) ?? summary);
		}
	}
	return exports;
}

function exampleNames(text: string, publicExports: ReadonlySet<string>) {
	const source = ts.createSourceFile('example.ts', text, ts.ScriptTarget.Latest);
	return source.statements.flatMap((statement) => {
		const names = exportedNames(statement);
		if (ts.isFunctionDeclaration(statement))
			return readsPublicResult(source, statement, publicExports) ? names : [];
		if (!ts.isVariableStatement(statement)) return [];
		return statement.declarationList.declarations.flatMap(({ name, initializer }) =>
			ts.isIdentifier(name) &&
			names.includes(name.text) &&
			initializer &&
			(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
			readsPublicResult(source, initializer, publicExports)
				? [name.text]
				: []
		);
	});
}

function collectCitations(sources: Sources, folder: string, knownPrinciples: ReadonlySet<string>) {
	const moduleSources = Object.entries(sources)
		.filter(([path]) => path.startsWith(folder + '/') && !path.endsWith('.test.ts'))
		.map(([, source]) => source)
		.join('\n');
	const config = [
		...new Set(Array.from(moduleSources.matchAll(configImport), ([, slice]) => slice))
	].sort();
	const configSources = Object.entries(sources)
		.filter(([path]) => config.some((slice) => path.startsWith(`src/config/${slice}/`)))
		.map(([, source]) => source);
	const principles = [
		...new Set([moduleSources, ...configSources].join('\n').match(principleId) ?? [])
	]
		.filter((id) => knownPrinciples.has(id))
		.sort();
	return { config, principles };
}

function row(
	entry: string,
	folder: string,
	sources: Sources,
	knownPrinciples: ReadonlySet<string>
): ModuleRow {
	const examplePath = folder + '/example.ts';
	const example = Object.hasOwn(sources, examplePath) ? examplePath : null;
	const purpose = purposeLine.exec(sources[entry])?.[1].trim() || null;
	const docs = collectExports(entry, sources[entry]);
	const exports = new Set(docs.keys());
	const calls = example ? exampleNames(sources[example], exports) : [];
	const exampleCall = calls.includes('example') ? 'example' : (calls[0] ?? null);
	const errors = [];
	if (!purpose) errors.push('Missing module purpose in index.ts');
	const architecture = sources['docs/standards/ARCHITECTURE.md'] ?? '';
	const exampleDemo = example
		? null
		: (Array.from(architecture.matchAll(exampleExemption)).find(
				([, path]) => folder === path || folder.startsWith(path + '/')
			)?.[2] ?? null);
	if (!example && !exampleDemo) errors.push('Missing example.ts');
	else if (example && !exampleCall) errors.push('Missing example caller');
	for (const [name, summary] of docs) {
		if (!summary) errors.push(`Missing export documentation for ${name}`);
	}
	return {
		module: folder.slice('src/lib/'.length),
		purpose,
		exports: [...exports],
		exportDocumentation: Object.fromEntries(
			[...docs].flatMap(([name, summary]) => (summary ? [[name, summary] as const] : []))
		),
		example,
		exampleCall,
		exampleDemo,
		...collectCitations(sources, folder, knownPrinciples),
		errors
	};
}

/** Derives rows from public entries, fixed examples, config imports and register citations. */
export function buildModuleCatalogue(
	sources: Sources,
	knownPrinciples: ReadonlySet<string>
): ModuleRow[] {
	return Object.keys(sources)
		.sort()
		.flatMap((entry) => {
			const match = moduleEntry.exec(entry);
			return match ? [row(entry, match[1], sources, knownPrinciples)] : [];
		});
}
