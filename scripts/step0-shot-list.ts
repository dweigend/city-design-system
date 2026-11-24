// The Step 0 picture pass: every route, the town review's focus and framing choices, dark theme
// and phone shots, grouped by contact sheet.
export type Shot = Readonly<{
	sheet: string;
	route: string;
	size: 'desktop' | 'phone';
	theme: 'light' | 'dark';
}>;

/** Viewport sizes in CSS pixels. */
export const sizes = { desktop: [1600, 1000], phone: [390, 844] } as const;

const routes = [
	'/',
	'/landscape',
	'/city',
	'/paths',
	'/supply',
	'/architecture',
	'/architecture?sheet=town&block=town',
	'/architecture/structure',
	'/surfaces',
	'/interface',
	'/blocks',
	'/content',
	'/story',
	'/sandbox',
	'/town'
];
const townFocus = ['town', 'plan', 'houses', 'paths', 'structure'].map(
	(focus) => `/town?focus=${focus}`
);
const cityFocus = ['plan', 'parcels', 'districts', 'lattice'].map(
	(focus) => `/city?focus=${focus}`
);
const frames = ['whole', 'quarter', 'street'].flatMap((frame) =>
	['iso', 'plan'].map((view) => `/town?frame=${frame}&view=${view}`)
);
const dark = [
	'/town',
	'/city',
	'/landscape',
	'/architecture?sheet=town&block=town',
	'/surfaces',
	'/sandbox',
	'/interface'
];
const phone = ['/', '/town', '/city', '/sandbox', '/interface'];
export const shots: Shot[] = [
	...routes.map((route) => ({ sheet: 'routes', route, size: 'desktop', theme: 'light' }) as const),
	...[...townFocus, ...cityFocus].map(
		(route) => ({ sheet: 'town-focus', route, size: 'desktop', theme: 'light' }) as const
	),
	...frames.map(
		(route) => ({ sheet: 'town-frames', route, size: 'desktop', theme: 'light' }) as const
	),
	...dark.map((route) => ({ sheet: 'dark', route, size: 'desktop', theme: 'dark' }) as const),
	...(['light', 'dark'] as const).flatMap((theme) =>
		phone.map((route) => ({ sheet: 'phone', route, size: 'phone', theme }) as const)
	)
];
