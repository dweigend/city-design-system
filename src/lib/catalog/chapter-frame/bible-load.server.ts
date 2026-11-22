import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { chapters, legacyMove } from '../data/chapters';

/** Loads a canonical chapter slug, or returns 404 for an unknown path. */
export function loadBible({ params }: { params: { bible: string } }) {
	const chapter = chapters.find((entry) => entry.slug === params.bible);
	if (!chapter) error(404, 'Chapter not found');
	return { slug: chapter.slug };
}

/** Permanently redirects a retired route ID, retaining applicable reader parameters. */
export function loadLegacyBible({ route, url }: { route: { id: string }; url: URL }) {
	const slug = route.id.slice(1);
	const move = legacyMove(slug, url.searchParams.get('group'));
	if (!move) error(404, 'Chapter not found');
	const search = new URLSearchParams(url.search);
	search.delete('legacy');
	if (move.archive) redirect(308, resolve('/archiv') + withQuery(search));

	const [bible, step] = move.target;
	const target = resolve('/[...bible]', { bible });
	// An HTTP redirect without a fragment lets the browser carry the old fragment forward.
	if (move.readsFragment) {
		search.set('legacy', slug);
		redirect(308, target + withQuery(search));
	}
	redirect(308, target + withQuery(search) + '#' + step);
}

function withQuery(search: URLSearchParams) {
	return search.size ? '?' + search.toString() : '';
}
