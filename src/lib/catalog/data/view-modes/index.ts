/** View and display IDs available on the shared stage. */
export const viewModes = ['iso', 'plan', 'terrain', 'schematic', 'section'] as const;
/** Displays available on the shared stage. */
export const displayModes = ['normal'] as const;

/** Labels for the view bar, shared by the stage controls. */
export const viewLabels = {
	iso: 'Iso',
	plan: 'Plan',
	schematic: 'Schematic',
	section: 'Section',
	terrain: 'Terrain'
} as const;

/** Labels for the display bar, including modes awaiting a stage implementation. */
export const displayLabels = {
	normal: 'Normal',
	transparency: 'Transparency',
	levels: 'Levels'
} as const;

export type ViewMode = (typeof viewModes)[number];
export type DisplayMode = (typeof displayModes)[number];

type Nonempty<T> = readonly [T, ...T[]];

/** A step's default view and display, and the choices it enables. */
export type ViewPolicy = Readonly<{
	view: ViewMode;
	views: Nonempty<ViewMode>;
	display: DisplayMode;
	displays?: Nonempty<DisplayMode>;
}>;
