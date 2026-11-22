/** Chapters in reading order, with their canonical routes and titles. */
export const chapters = [
	{ number: '1', slug: '/landscape', label: 'Landscape', title: 'Landscape and typography' },
	{ number: '2', slug: '/city', label: 'City', title: 'City' },
	{ number: '3', slug: '/paths', label: 'Paths', title: 'Paths and transport' },
	{ number: '4', slug: '/supply', label: 'Supply', title: 'Supply' },
	{ number: '5', slug: '/architecture', label: 'Architecture', title: 'Architecture' },
	{ number: '6', slug: '/surfaces', label: 'Surfaces', title: 'Colors and surfaces' },
	{ number: '7', slug: '/interface', label: 'Interface', title: 'Interface' },
	{ number: '8', slug: '/blocks', label: 'Blocks', title: '3D assets and building blocks' },
	{ number: '9', slug: '/content', label: 'Content', title: 'Content' },
	{ number: '9.1', slug: '/story', label: 'Story', title: 'Story line' }
] as const;

type Chapter = (typeof chapters)[number];

/** Get the chapter metadata for a canonical route. */
export function chapterAt(slug: Chapter['slug']): Chapter {
	const chapter = chapters.find((entry) => entry.slug === slug);
	if (!chapter) throw new Error('Unknown chapter: ' + slug);
	return chapter;
}
