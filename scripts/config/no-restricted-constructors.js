// @ts-check

const threeImport = /^three(?:\/|$)/;

/** @param {any} node */
function isTypeOnly(node) {
	return node?.importKind === 'type';
}

/** @param {any} node */
function propertyName(node) {
	if (!node) return null;
	if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
	if (node.computed && node.property?.type === 'Literal' && typeof node.property.value === 'string')
		return node.property.value;
	return null;
}

/** @param {any} prop */
function patternKey(prop) {
	if (prop.type !== 'Property') return null;
	if (!prop.computed && prop.key.type === 'Identifier') return prop.key.name;
	if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
	return null;
}

/** @param {string} source */
function subpathName(source) {
	const segment = source.split('/').at(-1) ?? '';
	return segment.replace(/\.(?:[cm]?js|[cm]?ts)$/, '');
}

/** @param {any} node */
function isThreeDynamicImport(node) {
	const target = node?.type === 'AwaitExpression' ? node.argument : node;
	if (target?.type === 'ImportExpression')
		return typeof target.source?.value === 'string' && threeImport.test(target.source.value);
	if (target?.type === 'CallExpression' && target.callee?.type === 'Identifier') {
		const [arg] = target.arguments ?? [];
		return (
			target.callee.name === 'require' &&
			arg?.type === 'Literal' &&
			typeof arg.value === 'string' &&
			threeImport.test(arg.value)
		);
	}
	return false;
}

/**
 * @param {any} spec
 * @param {string} source
 * @param {Map<string, string>} targetMessages
 * @param {Map<string, string>} tracked
 * @param {Set<string>} namespaces
 */
function recordImportSpecifier(spec, source, targetMessages, tracked, namespaces) {
	if (spec.type === 'ImportNamespaceSpecifier') {
		namespaces.add(spec.local.name);
		return;
	}
	if (spec.type === 'ImportDefaultSpecifier') {
		const message = targetMessages.get(subpathName(source));
		if (message) tracked.set(spec.local.name, message);
		return;
	}
	if (spec.type === 'ImportSpecifier' && !isTypeOnly(spec)) {
		const imported =
			spec.imported.type === 'Identifier' ? spec.imported.name : String(spec.imported.value);
		const message = targetMessages.get(imported);
		if (message) tracked.set(spec.local.name, message);
	}
}

/**
 * @param {any} pattern
 * @param {Map<string, string>} targetMessages
 * @param {Map<string, string>} tracked
 */
function recordObjectPattern(pattern, targetMessages, tracked) {
	for (const prop of pattern.properties) {
		const key = patternKey(prop);
		const message = key !== null ? targetMessages.get(key) : undefined;
		if (message && prop.value?.type === 'Identifier') tracked.set(prop.value.name, message);
	}
}

/**
 * Tracks named, default-subpath, namespace, destructured and aliased three.js constructor
 * bindings to their `new` construction sites so type or `instanceof` references stay allowed.
 * @type {import('eslint').Rule.RuleModule}
 */
export const noRestrictedConstructors = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'array',
				minItems: 1,
				items: {
					type: 'object',
					properties: {
						names: { type: 'array', items: { type: 'string' }, minItems: 1 },
						message: { type: 'string' }
					},
					required: ['names', 'message'],
					additionalProperties: false
				}
			}
		]
	},
	create(context) {
		/** @type {Map<string, string>} */
		const targetMessages = new Map();
		for (const { names, message } of context.options[0]) {
			for (const name of names) targetMessages.set(name, message);
		}
		/** @type {Map<string, string>} */
		const tracked = new Map();
		/** @type {Set<string>} */
		const namespaces = new Set();

		/** @param {any} node */
		function messageForExpression(node) {
			if (!node) return undefined;
			if (node.type === 'Identifier') return tracked.get(node.name);
			if (node.type === 'MemberExpression') {
				const prop = propertyName(node);
				return prop !== null ? targetMessages.get(prop) : undefined;
			}
			return undefined;
		}

		/** @param {any} node */
		function isNamespaceExpr(node) {
			return (
				(node?.type === 'Identifier' && namespaces.has(node.name)) || isThreeDynamicImport(node)
			);
		}

		return {
			ImportDeclaration(node) {
				if (isTypeOnly(node)) return;
				const source = typeof node.source?.value === 'string' ? node.source.value : '';
				if (!threeImport.test(source)) return;
				for (const spec of node.specifiers)
					recordImportSpecifier(spec, source, targetMessages, tracked, namespaces);
			},
			VariableDeclarator(node) {
				if (node.id.type === 'Identifier') {
					const message = messageForExpression(node.init);
					if (message) tracked.set(node.id.name, message);
					else if (isNamespaceExpr(node.init)) namespaces.add(node.id.name);
					return;
				}
				if (node.id.type === 'ObjectPattern' && isNamespaceExpr(node.init))
					recordObjectPattern(node.id, targetMessages, tracked);
			},
			NewExpression(node) {
				const { callee } = node;
				const message =
					callee.type === 'Identifier'
						? (tracked.get(callee.name) ?? targetMessages.get(callee.name))
						: messageForExpression(callee);
				if (message) context.report({ node, message });
			}
		};
	}
};
