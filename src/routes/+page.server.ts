import { chapters } from './chapters';

const chapterPages = import.meta.glob<{ lead?: string }>('./*/+page.svelte');

/** Deliver each chapter's own lead sentence to the contents page. */
export async function load() {
	const entries = await Promise.all(
		chapters.map(async ({ slug }) => {
			const page = await chapterPages['.' + slug + '/+page.svelte']?.();
			if (!page?.lead) throw new Error('Missing lead for ' + slug);
			return [slug, page.lead] as const;
		})
	);

	return { leads: Object.fromEntries(entries) };
}
