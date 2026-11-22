/** Chapters in reading order, with their canonical routes and titles. */
export const chapters = [
	{ number: '1', slug: '/landscape', title: 'Landscape and typography' },
	{ number: '2', slug: '/city', title: 'City' },
	{ number: '3', slug: '/paths', title: 'Paths and transport' },
	{ number: '4', slug: '/supply', title: 'Supply' },
	{ number: '5', slug: '/architecture', title: 'Architecture' },
	{ number: '6', slug: '/surfaces', title: 'Colors and surfaces' },
	{ number: '7', slug: '/interface', title: 'Interface' },
	{ number: '8', slug: '/blocks', title: '3D assets and building blocks' },
	{ number: '9', slug: '/content', title: 'Content' },
	{ number: '9.1', slug: '/story', title: 'Story line' }
] as const;

type Chapter = (typeof chapters)[number];

/** Get the chapter metadata for a canonical route. */
export function chapterAt(slug: Chapter['slug']): Chapter {
	const chapter = chapters.find((entry) => entry.slug === slug);
	if (!chapter) throw new Error('Unknown chapter: ' + slug);
	return chapter;
}
