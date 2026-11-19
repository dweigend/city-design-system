export type Style3D = 'line' | 'color' | 'blueprint';

export type Palette3D = {
	paper: string;
	ink: string;
	ink3?: string;
	blueprint: string;
	blueprintSoft: string;
	/** Category swatches by short name, with --signal and --body-living under their full names. */
	categories: Record<string, string>;
};
