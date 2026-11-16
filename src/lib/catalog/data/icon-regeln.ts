/**
 * Icon language (page /interface): rules with values, drawing modes, UI icons.
 * The drawings themselves live in data/icons.ts. Based on Lucide: five libraries compared
 * on 2026-11-12 (Lucide, Tabler, Phosphor, Iconoir, Carbon); the product now uses a single set.
 */
export const iconRegeln: { begriff: string; text: string; formel?: string }[] = [
	{
		begriff: 'Grid',
		text: '24 × 24 units. The drawing stays within 2 to 22. Points sit on whole or half units.',
		formel: '24 · margin 2'
	},
	{
		begriff: 'Stroke',
		text: 'One 1.5 px pen, the same at every size. Caps and joins are round, as in Lucide.',
		formel: '1.5 px, round'
	},
	{
		begriff: 'Spacing',
		text: 'Parallel lines sit 4 units apart. That keeps the icon open at 16 px.',
		formel: '≥ 4 units'
	},
	{
		begriff: 'Axonometry',
		text: 'Volumes stand in the world’s 2:1 dimetric view: edges run 2 sideways and 1 down. Circles become 2:1 ellipses.',
		formel: 'Form groups'
	},
	{
		begriff: 'Section and plan',
		text: 'Zones and context rules are drawn orthogonally. The ground line sits at 21.',
		formel: 'Building zones · Context rules'
	},
	{
		begriff: 'Signs',
		text: 'Flows are flat, closed signs built from circle, arc and straight line.',
		formel: 'Flows'
	},
	{
		begriff: 'Edges',
		text: 'Hidden edges are dropped. The exception is the load-bearing structure: there, the frame is the content. A line that ends freely means: it continues.'
	},
	{
		begriff: 'Mass',
		text: 'The form filled in ink shows what is meant: the zone in section, the component of the rule.'
	},
	{
		begriff: 'Color',
		text: 'A fill only takes the color of a flow. The stroke stays ink. Existing stock and load-bearing structure stay colorless.'
	},
	{
		begriff: 'Dashing',
		text: 'In the world, dashed means planned. Icons themselves never use dashes.'
	},
	{
		begriff: 'Sizes',
		text: '16 in text, 20 in compact controls, 24 as the default, 48 in the vocabulary. No sizes in between.',
		formel: '16 · 20 · 24 · 48'
	},
	{
		begriff: 'Accessibility',
		text: 'Next to text, the icon is silent. On its own, it carries a name. Shape carries the meaning; color only adds to it.'
	}
];

/** Three drawing modes, one example each for the construction plate. */
export const iconDarstellungen: { id: string; titel: string; text: string }[] = [
	{ id: 'axonometrie', titel: 'Axonometry', text: 'Volume. Edges at a 2:1 ratio.' },
	{ id: 'schnitt', titel: 'Section', text: 'Zone or rule. Mass shows what is meant.' },
	{ id: 'zeichen', titel: 'Sign', text: 'Flow. The fill carries the color.' }
];

/** UI icons from Lucide. `name` is the Lucide name. */
export const uiIcons = [
	{ name: 'chevron-left', rolle: 'Back' },
	{ name: 'chevron-right', rolle: 'Next' },
	{ name: 'plus', rolle: 'Add' },
	{ name: 'x', rolle: 'Close' },
	{ name: 'check', rolle: 'Confirmed' },
	{ name: 'info', rolle: 'Info' },
	{ name: 'ellipsis', rolle: 'More' },
	{ name: 'mouse-pointer-2', rolle: 'Select' },
	{ name: 'building-2', rolle: 'Build' },
	{ name: 'route', rolle: 'Paths' },
	{ name: 'trees', rolle: 'Green' },
	{ name: 'layers', rolle: 'Layers' },
	{ name: 'menu', rolle: 'Navigation' },
	{ name: 'sliders-horizontal', rolle: 'Controls' },
	{ name: 'rotate-ccw', rolle: 'Reset' },
	{ name: 'sun', rolle: 'Light' },
	{ name: 'moon', rolle: 'Dark' }
] as const;

export type UiIconName = (typeof uiIcons)[number]['name'];
