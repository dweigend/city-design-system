import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import type { StudienProfil, Vec3 } from './formen';

export type BauTeil = { name: string; mass: Vec3; lage: Vec3; profil?: StudienProfil };

const fase = { art: 'fase', radius: 0.06 } as const;
const rohr = { art: 'rohr', wand: 0.12 } as const;

const teileVon: Partial<Record<AusfuehrungId, readonly BauTeil[]>> = {
	'metall-messing': [
		{
			name: 'brass-facets',
			mass: [2.7, 2.4, 2.5],
			lage: [-1.1, 0.02, 0.22],
			profil: { art: 'facetten' }
		},
		{
			name: 'polished-brass-sleeve',
			mass: [1.62, 1.62, 2.13],
			lage: [1.4, -0.64, 0.22],
			profil: rohr
		}
	],
	'metall-kupfer': [
		{ name: 'copper-duct', mass: [1.65, 1.65, 2.85], lage: [-0.88, 0.33, 0.22], profil: rohr },
		{
			name: 'copper-duct-flange',
			mass: [1.81, 1.81, 0.13],
			lage: [-0.88, 0.33, 1.31],
			profil: rohr
		},
		{ name: 'copper-sleeve', mass: [1.35, 1.35, 1.75], lage: [1.0, -0.48, 0.22], profil: rohr }
	],
	'keramik-schachbrett': [
		{ name: 'tiled-corner', mass: [2.5, 1.85, 2.45], lage: [-0.65, 0.18, 0.22], profil: fase },
		{ name: 'cut-tile', mass: [1.46, 1.46, 0.19], lage: [1.35, -0.67, 0.22] }
	],
	'kunststoff-gerippt': [
		{
			name: 'corrugated-panel',
			mass: [3.85, 0.27, 2.4],
			lage: [-0.35, 0.42, 0.22],
			profil: { art: 'wellenplatte' }
		},
		{
			name: 'corrugated-cut',
			mass: [1.54, 0.27, 0.93],
			lage: [1.1, -0.87, 0.22],
			profil: { art: 'wellenplatte' }
		}
	],
	'kunststoff-marmoriert': [
		{
			name: 'cast-resin-body',
			mass: [2.55, 2.15, 2.55],
			lage: [-0.5, 0.22, 0.22],
			profil: { art: 'fase', radius: 0.25 }
		},
		{
			name: 'cast-resin-offcut',
			mass: [1.18, 1.32, 0.83],
			lage: [1.62, -0.48, 0.22],
			profil: { art: 'fase', radius: 0.14 }
		}
	],
	'glas-photovoltaik': [
		{
			name: 'glazed-solar-array',
			mass: [3.56, 2.38, 0.12],
			lage: [-0.5, 0.6, 0.55],
			profil: { art: 'fase', radius: 0.022 }
		},
		{
			name: 'glazed-solar-module',
			mass: [1.83, 1.05, 0.1],
			lage: [1.14, -1.28, 0.22],
			profil: { art: 'fase', radius: 0.022 }
		}
	],
	'membran-goldfolie': [
		{
			name: 'wrapped-gold-corner',
			mass: [2.15, 2.02, 1.71],
			lage: [-0.85, 0.32, 0.22],
			profil: { art: 'folie' }
		},
		{
			name: 'wrapped-gold-offcut',
			mass: [1.58, 1.02, 0.39],
			lage: [1.24, -0.54, 0.22],
			profil: { art: 'folie' }
		}
	],
	'membran-flor': [
		{
			name: 'pile-covered-sleeve',
			mass: [2.35, 2.35, 2.45],
			lage: [-0.6, 0.36, 0.22],
			profil: { art: 'flor', wand: 0.23 }
		},
		{
			name: 'pile-cutting',
			mass: [1.47, 1.29, 0.46],
			lage: [1.44, -0.74, 0.22],
			profil: { art: 'fase', radius: 0.17 }
		}
	]
};

/** Looks up static specimen shapes in metres for a finish that needs its own model. */
export function referenzTeile(id?: AusfuehrungId): readonly BauTeil[] | undefined {
	return id === undefined ? undefined : teileVon[id];
}
