import { defaults } from '../../../config/sandbox-interaction';

/** One requested product: a stable owner ID, a key naming its exact inputs and a pure build. */
export type BuildJob<T> = Readonly<{ id: string; key: string; run: () => T }>;

// Exact arithmetic: keep the two latest builds of an owner.
const productsPerOwner = 2;

/** Creates a time-budgeted build queue. Jobs run first in, first out; resubmitting an owner moves
 * it to the back and replaces its waiting job. A product already built for the same key is reused
 * at once. Each `advance` runs at least one job, then stops when `budgetMs` (by default the
 * configured frame build budget) has passed on `now`. */
export function createBuildQueue<T>(now: () => number, budgetMs: number = defaults.buildBudgetMs) {
	const waiting = new Map<string, BuildJob<T>>();
	const products = new Map<string, Map<string, T>>();
	const current = new Map<string, string>();

	function keep(id: string, key: string, product: T) {
		const owned = products.get(id) ?? new Map<string, T>();
		owned.delete(key);
		owned.set(key, product);
		while (owned.size > productsPerOwner) owned.delete(owned.keys().next().value as string);
		products.set(id, owned);
	}

	return Object.freeze({
		/** Requests a product for an owner. Returns true when a cached product already answers it. */
		submit(job: BuildJob<T>) {
			current.set(job.id, job.key);
			waiting.delete(job.id);
			if (products.get(job.id)?.has(job.key)) return true;
			waiting.set(job.id, job);
			return false;
		},
		/** Drops an owner's waiting job and products, for a removed placement. */
		cancel(id: string) {
			waiting.delete(id);
			products.delete(id);
			current.delete(id);
		},
		/** Runs waiting jobs in order within the budget and returns the owners built. */
		advance() {
			const start = now();
			const built: string[] = [];
			for (const job of waiting.values()) {
				if (built.length && now() - start >= budgetMs) break;
				waiting.delete(job.id);
				keep(job.id, job.key, job.run());
				built.push(job.id);
			}
			return built;
		},
		/** The product for an owner's current key, or while that waits, its latest older product. */
		read(id: string) {
			const owned = products.get(id);
			const key = current.get(id);
			if (!owned || key === undefined) return undefined;
			return owned.get(key) ?? [...owned.values()].at(-1);
		},
		/** True while an owner's current request waits. */
		isWaiting: (id: string) => waiting.has(id),
		/** The number of waiting jobs. */
		readWaiting: () => waiting.size
	});
}

/** Shortest time in milliseconds between two showings of built products while the queue is busy. */
export const showIntervalMs = defaults.showIntervalMs;
