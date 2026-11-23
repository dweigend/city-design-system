const functions = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression']);
const comparisons = new Set(['<', '<=', '>', '>=', '==', '===', '!=', '!==']);
const arithmetic = new Set(['+', '-', '*', '/', '%']);

function expression(node) {
	while (node.parent.type === 'UnaryExpression' && ['+', '-'].includes(node.parent.operator)) {
		node = node.parent;
	}
	return node;
}

function isIndex(node) {
	return node.parent.type === 'MemberExpression' && node.parent.property === node;
}

function isLength(node) {
	return node.type === 'MemberExpression' && node.property.name === 'length';
}

function isStride(node, value) {
	const { parent } = node;
	if (parent.type === 'AssignmentExpression' && ['+=', '-='].includes(parent.operator)) {
		const loop = parent.parent;
		return value <= 3 && loop.type === 'ForStatement' && loop.update === parent;
	}
	if (![2, 3].includes(value) || parent.type !== 'BinaryExpression') return false;
	const other = parent.left === node ? parent.right : parent.left;
	if (isIndex(parent) || isIndex(parent.parent)) return true;
	if (['/', '%', '-'].includes(parent.operator) && isLength(other)) return true;
	return value === 2 && ['*', '/', '**'].includes(parent.operator);
}

function isLoopStart(node) {
	const declaration = node.parent;
	return (
		declaration.type === 'VariableDeclarator' &&
		declaration.parent.parent.type === 'ForStatement' &&
		declaration.parent.parent.init === declaration.parent
	);
}

function isArithmetic(node, value) {
	const { parent } = node;
	if (parent.type === 'BinaryExpression') {
		if (value <= 1)
			return (
				comparisons.has(parent.operator) ||
				arithmetic.has(parent.operator) ||
				['|', '>>>', '<<', '>>'].includes(parent.operator)
			);
		return value === 2 && parent.operator === '-' && ['side', 'length'].includes(parent.left.name);
	}
	return (
		value <= 1 &&
		(parent.type === 'ReturnStatement' ||
			(parent.type === 'ArrowFunctionExpression' && parent.parent.type === 'ReturnStatement') ||
			parent.type === 'ConditionalExpression' ||
			parent.type === 'LogicalExpression' ||
			(parent.type === 'AssignmentExpression' &&
				parent.left.type === 'MemberExpression' &&
				parent.left.computed) ||
			(parent.type === 'VariableDeclarator' && parent.parent.kind === 'let') ||
			(parent.type === 'CallExpression' &&
				parent.callee.type === 'MemberExpression' &&
				parent.callee.object.name === 'Math' &&
				['min', 'max'].includes(parent.callee.property.name)))
	);
}

function isExactHelper(node, source) {
	for (let current = node.parent; current; current = current.parent) {
		if (!functions.has(current.type) && current.type !== 'VariableDeclaration') continue;
		const owner = current.parent.type === 'ExportNamedDeclaration' ? current.parent : current;
		if (source.getCommentsBefore(owner).some(({ value }) => /^ Exact arithmetic: \S/.test(value)))
			return true;
	}
	return false;
}

function isPositionalArgument(node, value) {
	const { parent } = node;
	if (value > 3 || !Number.isInteger(value) || parent.type !== 'CallExpression') return false;
	const { callee } = parent;
	return (
		(callee.type === 'MemberExpression' && ['at', 'slice'].includes(callee.property.name)) ||
		(callee.type === 'Identifier' && callee.name === 'pointAt' && parent.arguments[1] === node) ||
		(callee.type === 'MemberExpression' &&
			callee.property.name === 'reduce' &&
			value <= 1 &&
			parent.arguments[1] === node)
	);
}

function structural(node, value) {
	if (isIndex(node) && Number.isInteger(value)) return true;
	if (isLoopStart(node) && value <= 1) return true;
	if (isStride(node, value) || isArithmetic(node, value) || isPositionalArgument(node, value))
		return true;
	const { parent } = node;
	return (
		value === 0.5 && parent.type === 'BinaryExpression' && ['+', '-'].includes(parent.operator)
	);
}

export const noTunableNumber = {
	meta: {
		type: 'problem',
		schema: [],
		messages: { setting: 'Source numeric tunables from this module’s configuration slice.' }
	},
	create(context) {
		return {
			Literal(literal) {
				if (typeof literal.value !== 'number') return;
				const node = expression(literal);
				if (node.parent.type === 'TSLiteralType') return;
				if (structural(node, literal.value) || isExactHelper(node, context.sourceCode)) return;
				context.report({ node, messageId: 'setting' });
			}
		};
	}
};
