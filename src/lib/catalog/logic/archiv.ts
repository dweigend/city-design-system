import { herkunftLabels, type ArchivItem, type Herkunft } from '../data/archiv';

/**
 * Origin options in label order from the full collection, independent of active filters.
 * Empty groups stay hidden. The input stays unchanged; the list is detached.
 */
export function verfuegbareHerkunft(items: readonly ArchivItem[]): Herkunft[] {
	const vorhanden = new Set(items.map((item) => item.herkunft));
	return (Object.keys(herkunftLabels) as Herkunft[]).filter((herkunft) => vorhanden.has(herkunft));
}
