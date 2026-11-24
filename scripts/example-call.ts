import ts from 'typescript';

type Example = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;

function callable(node: ts.Node): node is Example {
	return (
		ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)
	);
}

function publicBindings(source: ts.SourceFile, exports: ReadonlySet<string>) {
	const names = new Set<string>();
	for (const statement of source.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			statement.moduleSpecifier.text !== './index'
		)
			continue;
		const clause = statement.importClause;
		if (!clause || clause.isTypeOnly) continue;
		if (clause.name && exports.has('default')) names.add(clause.name.text);
		const named = clause.namedBindings;
		if (named && ts.isNamedImports(named))
			for (const binding of named.elements)
				if (!binding.isTypeOnly && exports.has((binding.propertyName ?? binding.name).text))
					names.add(binding.name.text);
	}
	return names;
}

function declarations(source: ts.SourceFile) {
	const bindings = new Map<string, ts.Node>();
	const bind = (name: ts.BindingName, value: ts.Node) => {
		if (ts.isIdentifier(name)) bindings.set(name.text, value);
		else for (const item of name.elements) if (ts.isBindingElement(item)) bind(item.name, value);
	};
	const visit = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && node.initializer) bind(node.name, node.initializer);
		if (ts.isParameter(node) && node.initializer) bind(node.name, node.initializer);
		if (ts.isFunctionDeclaration(node) && node.name) bindings.set(node.name.text, node);
		ts.forEachChild(node, visit);
	};
	visit(source);
	return bindings;
}

/** Checks that the example returns a value derived from its module's public entry point. */
export function readsPublicResult(
	source: ts.SourceFile,
	example: Example,
	exports: ReadonlySet<string>
) {
	const publicNames = publicBindings(source, exports);
	const bindings = declarations(source);
	const seen = new Set<ts.Node>();
	function depends(node: ts.Node): boolean {
		if (seen.has(node)) return false;
		seen.add(node);
		if (ts.isTypeNode(node)) return false;
		if (ts.isIdentifier(node)) {
			const binding = bindings.get(node.text);
			return binding ? depends(binding) : publicNames.has(node.text);
		}
		if (callable(node)) return node.body !== undefined && returned(node.body);
		if (ts.isPropertyAccessExpression(node)) return depends(node.expression);
		if (ts.isPropertyAssignment(node)) return depends(node.initializer);
		return ts.forEachChild(node, depends) === true;
	}
	function returned(node: ts.Node): boolean {
		if (!ts.isBlock(node)) return depends(node);
		function visit(part: ts.Node): boolean {
			if (ts.isReturnStatement(part))
				return part.expression !== undefined && depends(part.expression);
			return !callable(part) && ts.forEachChild(part, visit) === true;
		}
		return visit(node);
	}
	return example.body !== undefined && returned(example.body);
}
