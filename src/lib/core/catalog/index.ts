/** Module: Indexes ordered rows by exact string ID. */

/** A row's stable registration key. */
export type CatalogRow = { readonly id: string };

/** An ordered snapshot of registered rows with exact ID lookup. */
export type Catalog<T extends CatalogRow> = Readonly<{
	ids: readonly T['id'][];
	rows: readonly T[];
	has(id: string): boolean;
	/** Reads the registered row or throws the configured missing-ID error. */
	get(id: string): T;
	/** Lists rows in registration order, optionally keeping only those matching the predicate. */
	list(filter?: (row: T) => boolean): readonly T[];
}>;

/** Rows and optional validation and error policies. Validators can also throw their own errors. */
export type CatalogOptions<T extends CatalogRow> = Readonly<{
	rows: readonly T[];
	validateId?: (id: string) => boolean;
	validateRow?: (row: T) => boolean | void;
	missingError?: (id: string) => Error;
}>;

/** Snapshots and freezes membership and order while retaining each row's identity.
 * Rejects invalid and duplicate IDs and rejected rows with RangeError. */
export function createCatalog<T extends CatalogRow>({
	rows,
	validateId = (id) => id.trim().length > 0,
	validateRow,
	missingError = (id) => new RangeError(`Unknown catalog ID "${id}"`)
}: CatalogOptions<T>): Catalog<T> {
	const byId = new Map<T['id'], T>();
	for (const row of rows) {
		const { id } = row;
		if (typeof id !== 'string' || !validateId(id))
			throw new RangeError(`Invalid catalog ID "${String(id)}"`);
		if (byId.has(id)) throw new RangeError(`Duplicate catalog ID "${id}"`);
		if (validateRow?.(row) === false) throw new RangeError(`Invalid catalog row "${id}"`);
		byId.set(id, row);
	}

	const ids = Object.freeze([...byId.keys()]);
	const registered = Object.freeze([...byId.values()]);
	return Object.freeze({
		ids,
		rows: registered,
		has: (id: string) => byId.has(id),
		get(id: string) {
			const row = byId.get(id);
			if (!row) throw missingError(id);
			return row;
		},
		list: (filter?: (row: T) => boolean) =>
			filter ? Object.freeze(registered.filter(filter)) : registered
	});
}
