/**
 * Archive filter, headless: no Svelte, no DOM.
 * Within a facet “or” applies, between facets and provenance “and”.
 */
import type { ArchivFacet, ArchivItem, Herkunft } from '../data/archiv';

export type Facet = ArchivFacet;
export const facets: Facet[] = ['ansicht', 'stil', 'form', 'material', 'oberflaeche'];
export const facetLabels: Record<Facet, string> = {
	ansicht: 'View',
	stil: 'Style',
	form: 'Form',
	material: 'Material',
	oberflaeche: 'Surface'
};

export type ArchivFilter = { herkunft: Herkunft | null } & Record<Facet, string[]>;

export const emptyFilter = (): ArchivFilter => ({
	herkunft: null,
	ansicht: [],
	stil: [],
	form: [],
	material: [],
	oberflaeche: []
});

/** Does the image match all facets? `skip` leaves out one facet (for counts within it). */
export function matches(item: ArchivItem, f: ArchivFilter, skip?: Facet | 'herkunft'): boolean {
	if (skip !== 'herkunft' && f.herkunft && item.herkunft !== f.herkunft) return false;
	return facets.every(
		(k) => k === skip || f[k].length === 0 || f[k].some((t) => item.begriffe[k].includes(t))
	);
}

export const applyFilter = (items: ArchivItem[], f: ArchivFilter) =>
	items.filter((i) => matches(i, f));

/**
 * Terms of a facet with hit count under the other filters.
 * Order: most frequent in the whole archive first, then alphabetical; stable while filtering.
 */
export function facetTerms(items: ArchivItem[], f: ArchivFilter, key: Facet) {
	const total = new Map<string, number>();
	const hits = new Map<string, number>();
	for (const item of items) {
		const ok = matches(item, f, key);
		for (const t of item.begriffe[key]) {
			total.set(t, (total.get(t) ?? 0) + 1);
			if (ok) hits.set(t, (hits.get(t) ?? 0) + 1);
		}
	}
	return [...total]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
		.map(([term]) => ({ term, count: hits.get(term) ?? 0 }));
}

/** Hit count per provenance under the other filters; `null` counts all. */
export function herkunftCount(items: ArchivItem[], f: ArchivFilter, herkunft: Herkunft | null) {
	return items.filter(
		(i) => matches(i, f, 'herkunft') && (herkunft === null || i.herkunft === herkunft)
	).length;
}

/** Select or deselect a term; returns a new filter. */
export function toggleTerm(f: ArchivFilter, key: Facet, term: string): ArchivFilter {
	const on = f[key].includes(term);
	return { ...f, [key]: on ? f[key].filter((t) => t !== term) : [...f[key], term] };
}

/** Active terms in selection order per facet, for removable chips. */
export const activeTerms = (f: ArchivFilter) =>
	facets.flatMap((key) => f[key].map((term) => ({ key, term })));
