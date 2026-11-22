/** Canonical pages and visible headings, independent of the catalog data. */
export const pageRoutes = [
	{ path: '/landschaft', title: 'Landscape and typography' },
	{ path: '/stadtbau', title: 'City' },
	{ path: '/wege', title: 'Paths and transport' },
	{ path: '/versorgung', title: 'Supply' },
	{ path: '/architektur', title: 'Architecture' },
	{ path: '/oberflaechen', title: 'Color and surfaces' },
	{ path: '/ui', title: 'UI' },
	{ path: '/bausteine', title: '3D assets and building blocks' },
	{ path: '/inhalte', title: 'Content and background' },
	{ path: '/geschichte', title: 'Story line' },
	{ path: '/archiv', title: 'Archive' }
] as const;

/** Representative permanent moves, including bookmarks that cross chapters. */
export const redirects = [
	['/', '/stadtbau#step-0'],
	['/raster', '/stadtbau#step-1'],
	['/raster#spatial-grid', '/stadtbau#step-2'],
	['/formen/haus#formen-weg', '/wege#step-4'],
	['/interface#interface-schrift', '/landschaft#step-4'],
	['/interface#engine-path', '/bausteine#step-7'],
	['/prinzipien', '/stadtbau#step-3'],
	['/bibliothek', '/archiv']
] as const;

/** Opt-in evidence targets for the chapter pages and their shared stage. */
export const captureTargets: {
	id: string;
	path: string;
	demo?: { role: 'region'; name: string };
	seed?: number;
}[] = [
	...pageRoutes.map((r) => ({ id: `page-${r.path.slice(1)}`, path: r.path })),
	{
		id: 'demo-valley',
		path: '/landschaft?view=iso#step-2',
		demo: { role: 'region', name: 'Chapter stage' },
		seed: 1201
	}
];
