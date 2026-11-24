// The Step 0 picture pass: every route, the town review's focus and framing choices, dark theme
// and phone shots, grouped by contact sheet.
export type Shot = Readonly<{
	sheet: string;
	route: string;
	size: 'desktop' | 'phone';
	theme: 'light' | 'dark';
	stages: number;
}>;

/** Viewport sizes in CSS pixels. */
export const sizes = { desktop: [1600, 1000], phone: [390, 844] } as const;

const stageCounts: Readonly<Record<string, number>> = {
	'/': 0,
	'/supply': 0,
	'/interface': 0,
	'/content': 0,
	'/story': 0,
	'/surfaces': 2
};

function stagesFor(route: string) {
	const path = route.split('?')[0];
	return stageCounts[path] ?? 1;
}

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
const shot = (
	sheet: string,
	route: string,
	size: 'desktop' | 'phone',
	theme: 'light' | 'dark'
): Shot => ({
	sheet,
	route,
	size,
	theme,
	stages: stagesFor(route)
});

export const shots: Shot[] = [
	...routes.map((route) => shot('routes', route, 'desktop', 'light')),
	...[...townFocus, ...cityFocus].map((route) => shot('town-focus', route, 'desktop', 'light')),
	...frames.map((route) => shot('town-frames', route, 'desktop', 'light')),
	...dark.map((route) => shot('dark', route, 'desktop', 'dark')),
	...(['light', 'dark'] as const).flatMap((theme) =>
		phone.map((route) => shot('phone', route, 'phone', theme))
	)
];
