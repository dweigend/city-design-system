export type Style3D = 'line' | 'color' | 'blueprint';

export type Palette3D = {
	paper: string;
	ink: string;
	ink3?: string;
	blueprint: string;
	blueprintSoft: string;
	/** Categories by short name (living …) and --signal under its full name: scenes resolve
	 *  tokens via categories[token.replace('--cat-', '')], so signal comes along too. */
	categories: Record<string, string>;
};
