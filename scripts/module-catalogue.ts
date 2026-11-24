import ts from 'typescript';

type Sources = Readonly<Record<string, string>>;

/** Module metadata and any missing contract documentation. Paths are relative to the repository. */
export type ModuleRow = Readonly<{
	module: string;
	purpose: string | null;
	exports: readonly string[];
	example: string | null;
	exampleCall: string | null;
	config: readonly string[];
	principles: readonly string[];
	errors: readonly string[];
}>;

const moduleEntry = /^(src\/lib\/(?:core|domain|world|scene|ui)\/[^/]+)\/index\.ts$/;
const purposeLine = /^\/\*\* Module: ([^\n]+) \*\//;
const configImport = /['"](?:\.\.\/)+config\/([\w-]+)['"]/g;
const principleId = /\b[A-Z]+-\d+\b/g;

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
		return statement.declarationList.declarations.flatMap(({ name }) =>
			ts.isIdentifier(name) ? [name.text] : []
		);
	if (ts.isDeclarationStatement(statement) && statement.name) return [statement.name.text];
	return [];
}

function exampleNames(statement: ts.Statement) {
	if (ts.isFunctionDeclaration(statement) && statement.body) return exportedNames(statement);
	if (!ts.isVariableStatement(statement)) return [];
	const names = exportedNames(statement);
	return statement.declarationList.declarations.flatMap(({ name, initializer }) =>
		ts.isIdentifier(name) &&
		names.includes(name.text) &&
		initializer &&
		(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
			? [name.text]
			: []
	);
}

function statements(text: string) {
	return ts.createSourceFile('module.ts', text, ts.ScriptTarget.Latest).statements;
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
	const purpose = purposeLine.exec(sources[entry])?.[1] ?? null;
	const calls = example ? statements(sources[example]).flatMap(exampleNames) : [];
	const exampleCall = calls.includes('example') ? 'example' : (calls[0] ?? null);
	const errors = [];
	if (!purpose) errors.push('Missing module purpose in index.ts');
	if (!example) errors.push('Missing example.ts');
	else if (!exampleCall) errors.push('Missing example caller');
	return {
		module: folder.slice('src/lib/'.length),
		purpose,
		exports: [...new Set(statements(sources[entry]).flatMap(exportedNames))],
		example,
		exampleCall,
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
