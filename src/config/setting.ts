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

/** Freeze the slice, its entries, numeric bands and bounds once at initialization. */
export function defineSettings<const S extends Settings>(settings: S): Readonly<S> {
	for (const entry of Object.values(settings)) {
		if (Array.isArray(entry.value)) Object.freeze(entry.value);
		if (entry.bounds) Object.freeze(entry.bounds);
		Object.freeze(entry);
	}
	return Object.freeze(settings);
}

/** Resolve setting metadata to a frozen table of defaults for the owning module. */
export function settingValues<const S extends Settings>(settings: S) {
	return Object.freeze(
		Object.fromEntries(Object.entries(settings).map(([name, entry]) => [name, entry.value]))
	) as { readonly [K in keyof S]: S[K]['value'] };
}
