type Change = Readonly<{ path: readonly string[]; values: unknown }>;

function entries(value: object): Map<string, unknown> {
	return value instanceof Map ? value : new Map(Object.entries(value));
}

function isRecord(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(before: unknown, after: unknown): boolean {
	if (Object.is(before, after)) return true;
	if (Array.isArray(before) && Array.isArray(after))
		return before.length === after.length && before.every((value, i) => sameValue(value, after[i]));
	if (!isRecord(before) || !isRecord(after) || before instanceof Map !== after instanceof Map)
		return false;
	const oldEntries = entries(before);
	const newEntries = entries(after);
	return (
		oldEntries.size === newEntries.size &&
		[...oldEntries].every(
			([key, value]) => newEntries.has(key) && sameValue(value, newEntries.get(key))
		)
	);
}

function removedFrom(source: readonly unknown[], remaining: readonly unknown[]) {
	let index = 0;
	const removed = source.filter((value) => {
		if (index >= remaining.length || !sameValue(value, remaining[index])) return true;
		index++;
		return false;
	});
	return index === remaining.length ? removed : undefined;
}

function sequenceDelta(before: readonly unknown[], after: readonly unknown[]) {
	const removed = removedFrom(before, after);
	if (removed && !removed.length) return;
	if (removed && !removed.some((value) => after.some((retained) => sameValue(value, retained))))
		return ['remove', removed];
	if (before.every((item, index) => index < after.length && sameValue(item, after[index])))
		return ['append', after.slice(before.length)];
	return ['replace', before, after];
}

function relativeNumber(path: readonly string[]) {
	return path[0] === 'store' || (path.length === 1 && path[0] === 'nextAction');
}

function recordChanges(before: object, after: object, path: readonly string[]) {
	const oldEntries = entries(before);
	const newEntries = entries(after);
	return [...new Set([...oldEntries.keys(), ...newEntries.keys()])].flatMap((key) => {
		const child = [...path, key];
		if (!oldEntries.has(key)) return [{ path: child, values: ['set', newEntries.get(key)] }];
		if (!newEntries.has(key)) return [{ path: child, values: ['delete', oldEntries.get(key)] }];
		return stateChanges(oldEntries.get(key), newEntries.get(key), child);
	});
}

/** Walks every changed field. Immutable branches shared by both snapshots need no comparison. */
export function stateChanges(
	before: unknown,
	after: unknown,
	path: readonly string[] = []
): Change[] {
	if (Object.is(before, after)) return [];
	if (typeof before === 'number' && typeof after === 'number' && relativeNumber(path))
		return [{ path, values: ['increment', after - before] }];
	if (Array.isArray(before) && Array.isArray(after)) {
		const values = sequenceDelta(before, after);
		return values ? [{ path, values }] : [];
	}
	if (isRecord(before) && isRecord(after) && before instanceof Map === after instanceof Map)
		return recordChanges(before, after, path);
	return [{ path, values: ['replace', before, after] }];
}

const generatedId = /^(p\/|c\/|line)(\d+)(?=\/|$)/;

function collectIds(value: unknown, ids: Set<number>) {
	if (typeof value === 'string') {
		const match = generatedId.exec(value);
		if (match) ids.add(Number(match[2]));
	} else if (Array.isArray(value)) {
		for (const item of value) collectIds(item, ids);
	} else if (value && typeof value === 'object') {
		for (const [key, item] of entries(value)) {
			collectIds(key, ids);
			collectIds(item, ids);
		}
	}
}

function canonicalize(value: unknown, id: (text: string) => string): unknown {
	if (typeof value === 'string') return id(value);
	if (value === undefined) return ['undefined'];
	if (Array.isArray(value)) return ['array', value.map((item) => canonicalize(item, id))];
	if (!value || typeof value !== 'object') return value;
	const record = [...entries(value)].map(
		([key, item]) => [id(key), canonicalize(item, id)] as const
	);
	return [
		value instanceof Map ? 'map' : 'record',
		record.sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
	];
}

function renameActions(text: string, slot: (action: number) => string | number | undefined) {
	return text.replace(
		generatedId,
		(_, prefix: string, action: string) => prefix + '@' + slot(Number(action))
	);
}

function actionSlots(changes: readonly Change[]) {
	const records = new Map<number, string[]>();
	for (const change of changes) {
		const ids = new Set<number>();
		collectIds(change, ids);
		for (const id of ids) {
			const record = records.get(id) ?? [];
			const mark = (text: string) =>
				renameActions(text, (action) => (action === id ? 'self' : 'other'));
			record.push(JSON.stringify(canonicalize(change, mark)));
			records.set(id, record);
		}
	}
	const ranked = [...records].map(([id, record]) => [id, JSON.stringify(record.sort())] as const);
	ranked.sort(([, a], [, b]) => (a < b ? -1 : Number(a > b)));
	return new Map(ranked.map(([id], index) => [id, index]));
}

/** Serializes field changes by sorted path and normalizes generated IDs as linked action slots. */
export function canonicalChanges(changes: readonly Change[]) {
	const slots = actionSlots(changes);
	const rename = (text: string) => renameActions(text, (action) => slots.get(action));
	const keyed = changes.map(
		({ path, values }) => [JSON.stringify(path.map(rename)), canonicalize(values, rename)] as const
	);
	return JSON.stringify(keyed.sort(([a], [b]) => (a < b ? -1 : Number(a > b))));
}
