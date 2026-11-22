import type { ChapterSlug } from './registry';
import type { ChapterStep } from './types';

type Target = readonly [slug: ChapterSlug, step: ChapterStep['id']];
type Move = Readonly<{ target: Target; anchors?: Readonly<Record<string, Target>> }>;

const city: Target = ['stadtbau', 'step-0'];
const growth: Target = ['stadtbau', 'step-4'];
const methods: Target = ['architektur', 'step-2'];
const volume: Target = ['architektur', 'step-1'];
const flows: Target = ['oberflaechen', 'step-2'];
const palette: Target = ['oberflaechen', 'step-3'];
const stock: Target = ['oberflaechen', 'step-5'];
const print: Target = ['oberflaechen', 'step-6'];
const connections: Target = ['ui', 'step-5'];
const icons: Target = ['ui', 'step-7'];

const cityPage: Move = {
	target: city,
	anchors: {
		weiterbauen: ['stadtbau', 'step-5'],
		'CITY-4': ['wege', 'step-2'],
		hochwege: ['wege', 'step-4'],
		schwamm: ['versorgung', 'step-1'],
		bauteile: ['versorgung', 'step-4']
	}
};

const colors: Move = {
	target: flows,
	anchors: {
		'COLOR-4': palette,
		'COLOR-5': stock,
		'COLOR-6': ['oberflaechen', 'step-7'],
		'COLOR-7': ['oberflaechen', 'step-7'],
		'COLOR-8': ['oberflaechen', 'step-1']
	}
};
const growthPage: Move = {
	target: growth,
	anchors: { 'GROW-1': ['stadtbau', 'step-5'], 'GROW-2': ['stadtbau', 'step-6'] }
};
const moves: Readonly<Record<string, Move>> = {
	'': cityPage,
	stadt: cityPage,
	design: cityPage,
	raster: {
		target: ['stadtbau', 'step-1'],
		anchors: {
			'spatial-grid': ['stadtbau', 'step-2'],
			'GRID-2': ['stadtbau', 'step-2'],
			'court-growth': ['stadtbau', 'step-3']
		}
	},
	wachstum: growthPage,
	modellierung: growthPage,
	formen: {
		target: volume,
		anchors: {
			'construction-phases': ['architektur', 'step-7'],
			'FORM-10': ['architektur', 'step-8'],
			kuppel: methods,
			tragwerke: methods,
			'traeger-faltwerk': methods,
			'traeger-kuppel': methods,
			'traeger-wabe': methods,
			'traeger-raumfachwerk': methods,
			'traeger-gitterschale': methods
		}
	},
	'formen/haus': {
		target: ['architektur', 'step-4'],
		anchors: {
			'formen-ecken': volume,
			'formen-turm': ['architektur', 'step-4'],
			'formen-weg': ['wege', 'step-4'],
			'formen-stapel': methods,
			'formen-verformung': methods,
			'formen-vokabular': ['bausteine', 'step-0'],
			'formen-komposition': ['architektur', 'step-3']
		}
	},
	formlabor: { target: methods },
	farben: colors,
	fokus: colors,
	material: {
		target: palette,
		anchors: {
			'material-farbziel': flows,
			'material-formen': stock,
			'material-stufen': stock,
			'material-rezept': print
		}
	},
	interface: {
		target: ['ui', 'step-0'],
		anchors: {
			'interface-hud': ['ui', 'step-2'],
			'interface-bedienung': ['ui', 'step-3'],
			'interface-haus': ['ui', 'step-4'],
			'interface-werkbank': ['ui', 'step-4'],
			connections,
			fokus: ['ui', 'step-6'],
			'interface-icons': icons,
			'interface-schrift': ['landschaft', 'step-4'],
			'engine-path': ['bausteine', 'step-7']
		}
	},
	icons: { target: icons },
	labor: {
		target: city,
		anchors: {
			'labor-rechnen': ['stadtbau', 'step-3'],
			'labor-studien': methods,
			'labor-leitstil': print
		}
	},
	prinzipien: { target: ['stadtbau', 'step-3'] },
	'labor/assets': { target: ['bausteine', 'step-0'] },
	'labor/building-envelope': { target: volume },
	'labor/megastructure': { target: ['versorgung', 'step-3'] },
	'labor/references': { target: stock },
	'labor/traeger-neu': { target: methods }
};

const archiveAliases = new Set(['designs', 'bibliothek']);

/** Returns the permanent move for a legacy route, or undefined for other paths. */
export function legacyMove(path: string, assetGroup?: string | null) {
	if (archiveAliases.has(path)) return { archive: true } as const;
	if (!Object.hasOwn(moves, path)) return undefined;
	const { target, anchors } = moves[path];
	return {
		archive: false,
		target: path === 'labor/assets' && assetGroup === 'materials' ? palette : target,
		readsFragment: !!anchors
	} as const;
}

/** Resolves an inherited old fragment to a chapter step, falling back to the page's default. */
export function legacyStep(path: string, fragment: string) {
	if (!Object.hasOwn(moves, path)) return undefined;
	const { target, anchors } = moves[path];
	const name = fragment.slice(1);
	return anchors && Object.hasOwn(anchors, name) ? anchors[name] : target;
}
