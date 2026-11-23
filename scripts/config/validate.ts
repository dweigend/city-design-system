import ts from 'typescript';

const boundChecks = {
	min: (value: number, min: number) => value >= min,
	max: (value: number, max: number) => value <= max,
	exclusiveMin: (value: number, min: number) => value > min,
	exclusiveMax: (value: number, max: number) => value < max
};

type ConfigSlice = Readonly<{ path: string; entries: Readonly<Record<string, unknown>> }>;

function text(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function finite(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validBounds(bounds: unknown, values: readonly number[]) {
	if (!record(bounds) || !Object.isFrozen(bounds)) return false;
	const entries = Object.entries(bounds);
	if (!entries.length) return false;
	if (
		('min' in bounds && 'exclusiveMin' in bounds) ||
		('max' in bounds && 'exclusiveMax' in bounds)
	)
		return false;
	return entries.every(([key, limit]) => {
		if (!Object.hasOwn(boundChecks, key) || !finite(limit)) return false;
		return values.every((value) => boundChecks[key as keyof typeof boundChecks](value, limit));
	});
}

function checkEntry(entry: unknown, principles: ReadonlySet<string>): string[] {
	if (!record(entry) || !Object.isFrozen(entry)) return ['must be a frozen setting'];
	const { value, unit, meaning, bounds, principle, rationale } = entry;
	const errors: string[] = [];
	const values: readonly unknown[] = Array.isArray(value) ? Array.from(value) : [value];
	if (!text(unit)) errors.push('requires a unit');
	if (!text(meaning)) errors.push('requires a meaning');
	if (principle !== undefined && (!text(principle) || !principles.has(principle)))
		errors.push('unknown principle');
	if (principle === undefined && !text(rationale)) errors.push('requires a rationale');
	if (!values.length || !values.every(finite)) errors.push('requires finite defaults');
	else if (bounds !== undefined && !validBounds(bounds, values)) errors.push('invalid bounds');
	if (Array.isArray(value) && !Object.isFrozen(value)) errors.push('requires a frozen band');
	return errors;
}

/** Validate settings metadata across capability slices and report each invalid entry. */
export function validateConfig(slices: readonly ConfigSlice[], principles: ReadonlySet<string>) {
	const owners = new Map<string, string>();
	const errors: string[] = [];
	for (const { path, entries } of slices) {
		if (!Object.isFrozen(entries)) errors.push(`${path}: slice must be frozen`);
		for (const [key, entry] of Object.entries(entries)) {
			const owner = owners.get(key);
			if (owner) errors.push(`${path}:${key}: already owned by ${owner}`);
			else owners.set(key, path);
			for (const error of checkEntry(entry, principles)) errors.push(`${path}:${key}: ${error}`);
		}
	}
	return errors;
}


/** Find duplicate literal keys before evaluation can discard their earlier values. */
export function duplicateConfigKeys(path: string, text: string): string[] {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
	const errors: string[] = [];
	function visit(node: ts.Node) {
		if (ts.isObjectLiteralExpression(node)) {
			const keys = new Set<string>();
			for (const { name } of node.properties) {
				if (!name || (!ts.isIdentifier(name) && !ts.isStringLiteral(name))) continue;
				if (keys.has(name.text)) {
					const { line } = source.getLineAndCharacterOfPosition(name.getStart(source));
					errors.push(`${path}:${line + 1}: duplicate key ${name.text}`);
				}
				keys.add(name.text);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return errors;
}
