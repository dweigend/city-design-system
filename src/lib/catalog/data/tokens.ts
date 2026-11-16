/** A named color token. Values live only in app.css; the view resolves them live. */
export type Swatch = { name: string; token: string };
export type SwatchGroup = { id: string; title: string; swatches: Swatch[] };

export const colorGroups: SwatchGroup[] = [
	{
		id: 'base',
		title: 'Paper and ink',
		swatches: [
			{ name: 'Paper', token: '--paper' },
			{ name: 'Paper 2', token: '--paper-2' },
			{ name: 'Paper 3', token: '--paper-3' },
			{ name: 'Line', token: '--line' },
			{ name: 'Ink 3', token: '--ink-3' },
			{ name: 'Ink 2', token: '--ink-2' },
			{ name: 'Ink', token: '--ink' }
		]
	},
	{
		id: 'modes',
		title: 'Signal and blueprint',
		swatches: [
			{ name: 'Signal', token: '--signal' },
			{ name: 'Blueprint', token: '--blueprint' },
			{ name: 'Blueprint 1', token: '--blueprint-1' }
		]
	},
	{
		id: 'categories',
		title: 'Flows and hazard',
		swatches: [
			{ name: 'People', token: '--cat-business' },
			{ name: 'Water', token: '--cat-health' },
			{ name: 'Energy', token: '--cat-mobility' },
			{ name: 'Food', token: '--cat-nature' },
			{ name: 'Material', token: '--cat-living' },
			{ name: 'Hazard', token: '--cat-hazard' }
		]
	}
];

export type TypeRole = { id: string; name: string; spec: string; sample: string };

export const typeRoles: TypeRole[] = [
	{ id: 'display', name: 'Display', spec: 'Geist 700 · 40 · caps', sample: 'Neustadt' },
	{ id: 'figure', name: 'Figure', spec: 'Geist 300 · 64', sample: '12,480' },
	{ id: 'title', name: 'Title', spec: 'Geist 600 · 16 · caps', sample: 'Housing block north' },
	{
		id: 'body',
		name: 'Text',
		spec: 'Geist 400 · 16',
		sample: 'Six floors, roof garden, connection to the ring line.'
	},
	{ id: 'small', name: 'Small', spec: 'Geist 400 · 13', sample: 'Population growing since 2024.' },
	{
		id: 'label',
		name: 'Label',
		spec: 'Geist Mono 400 · 11 · caps',
		sample: '03.2.1 · Housing block · 2031'
	}
];
