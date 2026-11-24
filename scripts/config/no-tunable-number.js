/** @typedef {import('@typescript-eslint/utils').TSESTree.Node} Syntax */
/** @typedef {import('@typescript-eslint/utils').TSESLint.SourceCode} SourceCode */

const exactExpressions = new Set([
	'Literal',
	'UnaryExpression',
	'BinaryExpression',
	'ConditionalExpression',
	'ArrayExpression',
	'ObjectExpression'
]);
const expressionWrappers = new Set(['Property', 'TSAsExpression', 'TSSatisfiesExpression']);
const basicOperators = new Set([
	'<',
	'<=',
	'>',
	'>=',
	'==',
	'===',
	'!=',
	'!==',
	'+',
	'-',
	'*',
	'/',
	'%',
	'|',
	'>>>',
	'<<',
	'>>'
]);

/** @param {Syntax} node */
function expression(node) {
	while (node.parent?.type === 'UnaryExpression' && ['+', '-'].includes(node.parent.operator)) {
		node = node.parent;
	}
	return node;
}

/** @param {Syntax} node */
function identifier(node) {
	return node.type === 'Identifier' ? node.name : undefined;
}

/** @param {Syntax} node */
function isIndex(node) {
	return node.parent?.type === 'MemberExpression' && node.parent.property === node;
}

/** @param {Syntax} node */
function isLength(node) {
	return node.type === 'MemberExpression' && identifier(node.property) === 'length';
}

/** @param {Syntax} node @param {number} value */
function isStride(node, value) {
	const { parent } = node;
	if (parent?.type !== 'BinaryExpression' || ![2, 3].includes(value)) return false;
	if (isIndex(parent) || (parent.parent && isIndex(parent.parent))) return true;
	const other = parent.left === node ? parent.right : parent.left;
	if (['/', '%', '-'].includes(parent.operator) && isLength(other)) return true;
	return value === 2 && ['*', '/', '**'].includes(parent.operator);
}

/** @param {Syntax} node */
function isLoopStart(node) {
	const declaration = node.parent;
	if (declaration?.type !== 'VariableDeclarator') return false;
	const loop = declaration.parent.parent;
	return loop?.type === 'ForStatement' && loop.init === declaration.parent;
}

/** @param {Syntax} node @param {number} value */
function isLoopStride(node, value) {
	const { parent } = node;
	if (parent?.type !== 'AssignmentExpression' || !['+=', '-='].includes(parent.operator))
		return false;
	const loop = parent.parent;
	return value <= 3 && loop?.type === 'ForStatement' && loop.update === parent;
}

/** @param {Syntax} node */
function isClamp(node) {
	if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false;
	const { object, property } = node.callee;
	const name = identifier(property);
	return identifier(object) === 'Math' && (name === 'min' || name === 'max');
}

/** @param {Syntax} node @param {number} value */
function isArithmetic(node, value) {
	const { parent } = node;
	if (!parent) return false;
	if (parent.type === 'BinaryExpression') {
		const other = parent.left === node ? parent.right : parent.left;
		if (
			isLength(other) &&
			[2, 3].includes(value) &&
			['<', '<=', '>', '>=', '===', '!=='].includes(parent.operator)
		)
			return true;
		if (value <= 1) return basicOperators.has(parent.operator);
		return value === 2 && parent.operator === '-' && identifier(parent.left) === 'side';
	}
	if (value > 1) return false;
	switch (parent.type) {
		case 'ReturnStatement':
		case 'ConditionalExpression':
		case 'LogicalExpression':
			return true;
		case 'ArrowFunctionExpression':
			return parent.parent?.type === 'ReturnStatement';
		case 'AssignmentExpression':
			return parent.left.type === 'MemberExpression' && parent.left.computed;
		case 'VariableDeclarator':
			return parent.parent.kind === 'let';
		default:
			return isClamp(parent);
	}
}

/** @param {Syntax} node @param {SourceCode} source */
function hasExactComment(node, source) {
	/** @type {Syntax | import('@typescript-eslint/utils').TSESTree.Token | null} */
	let start = node;
	while (start) {
		if (
			source
				.getCommentsBefore(start)
				.some(({ type, value }) => type === 'Block' && /^ Exact arithmetic: \S/.test(value))
		)
			return true;
		/** @type {import('@typescript-eslint/utils').TSESTree.Token | null} */
		const previous = source.getTokenBefore(start);
		start = previous?.value === '(' ? previous : null;
	}
	return false;
}

/** @param {Syntax} node @param {SourceCode} source */
function isExactNumber(node, source) {
	let current = node;
	while (expressionWrappers.has(current.type) || exactExpressions.has(current.type)) {
		if (exactExpressions.has(current.type) && hasExactComment(current, source)) return true;
		if (!current.parent) break;
		current = current.parent;
	}
	return false;
}

/** @param {Syntax} node @param {number} value */
function isPositionalArgument(node, value) {
	const { parent } = node;
	if (parent?.type !== 'CallExpression' || value > 3 || !Number.isInteger(value)) return false;
	const { callee } = parent;
	if (callee.type === 'Identifier')
		return (
			(callee.name === 'pointAt' ||
				callee.name === 'isFiniteVector' ||
				callee.name === 'copyVector' ||
				callee.name === 'validateVector') &&
			parent.arguments[1] === node
		);
	if (callee.type !== 'MemberExpression') return false;
	const name = identifier(callee.property);
	return (
		name === 'at' ||
		name === 'slice' ||
		(name === 'splice' && value === 1 && parent.arguments[1] === node) ||
		(name === 'reduce' && value <= 1 && parent.arguments[1] === node)
	);
}

/** @param {Syntax} node @param {number} value */
function structural(node, value) {
	if (isIndex(node) && Number.isInteger(value)) return true;
	if (isLoopStart(node) && value <= 2) return true;
	if (isStride(node, value) || isLoopStride(node, value) || isArithmetic(node, value)) return true;
	if (isPositionalArgument(node, value)) return true;
	const { parent } = node;
	return (
		value === 0.5 && parent?.type === 'BinaryExpression' && ['+', '-'].includes(parent.operator)
	);
}

/** @type {import('eslint').Rule.RuleModule} */
export const noTunableNumber = {
	meta: {
		type: 'problem',
		schema: [],
		messages: { setting: 'Source numeric tunables from this module’s configuration slice.' }
	},
	create(context) {
		const source = /** @type {SourceCode} */ (/** @type {unknown} */ (context.sourceCode));
		return {
			Literal(literal) {
				if (typeof literal.value !== 'number') return;
				// The configured parsers add TypeScript and Svelte node kinds to ESLint's standard tree.
				const node = expression(/** @type {Syntax} */ (/** @type {unknown} */ (literal)));
				if (node.parent?.type === 'TSLiteralType' || 'bigint' in literal) return;
				if (structural(node, literal.value) || isExactNumber(node, source)) return;
				context.report({ node: literal, messageId: 'setting' });
			}
		};
	}
};
