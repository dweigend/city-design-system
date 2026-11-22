import { chapters } from './chapters';

const chapterLeads = import.meta.glob<string>('./*/+page.svelte', { eager: true, import: 'lead' });

/** Deliver each chapter's own lead sentence to the contents page. */
export function load() {
	const entries = chapters.map(({ slug }) => {
		const lead = chapterLeads['.' + slug + '/+page.svelte'];
		if (!lead) throw new Error('Missing lead for ' + slug);
		return [slug, lead] as const;
	});

	return { leads: Object.fromEntries(entries) };
}
