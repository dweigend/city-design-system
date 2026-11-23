type Bounds = Readonly<{
	min?: number;
	max?: number;
	exclusiveMin?: number;
	exclusiveMax?: number;
}>;

type SettingSource =
	| Readonly<{ principle: string; rationale?: string }>
	| Readonly<{ principle?: undefined; rationale: string }>;

/** A numeric default or ordered numeric band, with its unit and reason for existing. */
export type Setting = Readonly<{
	value: number | readonly number[];
	unit: string;
	meaning: string;
	bounds?: Bounds;
}> &
	SettingSource;

type Settings = Readonly<Record<string, Setting>>;
type Frozen<T> = T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T;

/** Freeze the slice, its entries, numeric bands and bounds once at initialization. */
export function defineSettings<const S extends Settings>(settings: S): Frozen<S> {
	for (const entry of Object.values(settings)) {
		if (Array.isArray(entry.value)) Object.freeze(entry.value);
		if (entry.bounds) Object.freeze(entry.bounds);
		Object.freeze(entry);
	}
	return Object.freeze(settings) as Frozen<S>;
}

type Intersection<T> = (T extends unknown ? (value: T) => void : never) extends (
	value: infer Result
) => void
	? Result
	: never;

/** Compose a capability from private groups and reject any duplicated key. */
export function joinSettings<const Groups extends readonly Settings[]>(...groups: Groups) {
	const entries = new Map<string, Setting>();
	for (const group of groups) {
		for (const [key, entry] of Object.entries(group)) {
			if (entries.has(key)) throw new Error(`Duplicate setting: ${key}`);
			entries.set(key, entry);
		}
	}
	return defineSettings(Object.fromEntries(entries)) as Frozen<Intersection<Groups[number]>>;
}

/** Resolve setting metadata to a frozen table of defaults for the owning module. */
export function settingValues<const S extends Settings>(settings: S) {
	return Object.freeze(
		Object.fromEntries(Object.entries(settings).map(([name, entry]) => [name, entry.value]))
	) as { readonly [K in keyof S]: Frozen<S[K]['value']> };
}
