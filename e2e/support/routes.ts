/**
 * Routes of the design bible as the browser scenarios see them. Kept independent of the
 * catalog on purpose: a renamed chapter must fail here, not silently follow the data.
 */
export type ChapterRoute = { path: string; title: string; nav: string };

/** Every page route with its level-1 heading and its name in the chapter navigation. */
export const pageRoutes: ChapterRoute[] = [
	{ path: '/', title: 'City', nav: 'City' },
	{ path: '/formen', title: 'Forms', nav: 'Forms' },
	{ path: '/formen/haus', title: 'Forms', nav: 'Forms' },
	{ path: '/raster', title: 'Grid', nav: 'Grid' },
	{ path: '/wachstum', title: 'Growth', nav: 'Growth' },
	{ path: '/farben', title: 'Color', nav: 'Color' },
	{ path: '/material', title: 'Material', nav: 'Material' },
	{ path: '/interface', title: 'Interface', nav: 'Interface' },
	{ path: '/labor', title: 'Lab', nav: 'Lab' },
	{ path: '/archiv', title: 'Archive', nav: 'Archive' }
];

/** Chapters reachable from the header navigation, in reading order. */
export const chapterRoutes = pageRoutes.filter((r) => r.path !== '/formen/haus');

/** Old addresses and where they must land (permanent redirects). */
export const redirects: { from: string; to: string; hash?: string }[] = [
	{ from: '/stadt', to: '/' },
	{ from: '/design', to: '/' },
	{ from: '/bibliothek', to: '/archiv' },
	{ from: '/designs', to: '/archiv' },
	{ from: '/modellierung', to: '/wachstum' },
	{ from: '/icons', to: '/interface' },
	{ from: '/fokus', to: '/farben' },
	{ from: '/prinzipien', to: '/labor', hash: '#labor-rechnen' }
];

/**
 * Screenshot targets for opt-in evidence: every page as a whole, plus single demos by their
 * accessible group name. One table drives capture; add a row to photograph a new page or demo.
 * `seed` records the demo's fixed start seed where the image depends on one.
 */
export type CaptureTarget = {
	id: string;
	path: string;
	/** Demo control group or section; absent = the full page. */
	demo?: { role: 'group' | 'region'; name: string };
	seed?: number;
};

const slug = (path: string) => (path === '/' ? 'stadt' : path.slice(1).replaceAll('/', '-'));

export const captureTargets: CaptureTarget[] = [
	...pageRoutes.map((r) => ({ id: `page-${slug(r.path)}`, path: r.path })),
	{
		id: 'demo-weiterbauen',
		path: '/',
		demo: { role: 'region', name: 'Retain, convert, extend' }
	},
	{
		id: 'demo-wachstum',
		path: '/wachstum',
		demo: { role: 'region', name: 'Paths first, then blocks' },
		seed: 1
	}
];
