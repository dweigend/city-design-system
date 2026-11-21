/** View and display IDs available on the shared stage. */
export const viewModes = ['iso', 'plan', 'terrain'] as const;
export const displayModes = ['normal'] as const;

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
