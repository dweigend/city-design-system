import type { Ausfuehrung } from './materialAusfuehrungTypen';
import { referenzAusfuehrungen } from './materialReferenzAusfuehrung';

export type { Ausfuehrung, AusfuehrungId } from './materialAusfuehrungTypen';

export const materialAusfuehrungen: readonly Ausfuehrung[] = [
	{
		id: 'metall-lackiert',
		familie: 'metall',
		name: 'Satin paint',
		beschreibung: 'Smooth powder-coated steel with soft paint highlights.',
		grundton: '#a1a7a5',
		pigment: 0.86,
		rauheit: 0.36,
		metall: 0.12,
		transmission: 0
	},
	{
		id: 'metall-gebuerstet',
		familie: 'metall',
		name: 'Brushed warm metal',
		beschreibung: 'Warm bare metal with fine brushing along the local beam axis.',
		grundton: '#be8d54',
		pigment: 0,
		rauheit: 0.28,
		metall: 1,
		transmission: 0
	},
	{
		id: 'metall-graphit',
		familie: 'metall',
		name: 'Graphite finish',
		beschreibung: 'Dark satin-coated steel for thin frames and window mullions.',
		grundton: '#444640',
		pigment: 0,
		rauheit: 0.45,
		metall: 0.26,
		transmission: 0
	},
	{
		id: 'metall-signalrot',
		familie: 'metall',
		name: 'Signal red',
		beschreibung: 'Opaque satin red for the pavilion display core.',
		grundton: '#f52d25',
		pigment: 0,
		rauheit: 0.36,
		metall: 0.04,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'metall-kalkgruen',
		familie: 'metall',
		name: 'Lime green',
		beschreibung: 'Opaque satin lime for the dipped footing study.',
		grundton: '#d2f85d',
		pigment: 0,
		rauheit: 0.39,
		metall: 0.04,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'keramik-glasiert',
		familie: 'keramik',
		name: 'Glazed clay',
		beschreibung: 'A glossy glaze over a gently uneven fired body.',
		grundton: '#b97754',
		pigment: 0.8,
		rauheit: 0.17,
		metall: 0,
		transmission: 0
	},
	{
		id: 'keramik-ton',
		familie: 'keramik',
		name: 'Unglazed clay',
		beschreibung: 'Warm fired clay with fine pores and a dry surface.',
		grundton: '#bd8269',
		pigment: 0.4,
		rauheit: 0.83,
		metall: 0,
		transmission: 0
	},
	{
		id: 'beton-schalung',
		familie: 'beton',
		name: 'Cast concrete',
		beschreibung: 'Neutral mineral binder with pores and subtle casting variation.',
		grundton: '#d0cfbd',
		pigment: 0.35,
		rauheit: 0.86,
		metall: 0,
		transmission: 0
	},
	{
		id: 'beton-terrazzo',
		familie: 'beton',
		name: 'Exposed aggregate',
		beschreibung: 'Small irregular stone inclusions in a neutral concrete binder.',
		grundton: '#c6c1b6',
		pigment: 0.46,
		rauheit: 0.59,
		metall: 0,
		transmission: 0
	},
	{
		id: 'beton-geadert',
		familie: 'beton',
		name: 'Veined mineral',
		beschreibung: 'Warm-white mineral with branching blue fractures and blush deposits.',
		grundton: '#f3ede6',
		pigment: 0,
		rauheit: 0.65,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'acryl-matt',
		familie: 'kunststoff',
		name: 'Frosted acrylic',
		beschreibung: 'Thick acrylic diffuses the interior through a fine etched surface.',
		grundton: '#e1e4de',
		pigment: 0.36,
		rauheit: 0.46,
		metall: 0,
		transmission: 0.84
	},
	{
		id: 'kunststoff-formteil',
		familie: 'kunststoff',
		name: 'Molded polymer',
		beschreibung: 'Smooth solid polymer with broad soft highlights.',
		grundton: '#ded6ba',
		pigment: 0.85,
		rauheit: 0.3,
		metall: 0,
		transmission: 0
	},
	{
		id: 'kunststoff-guss',
		familie: 'kunststoff',
		name: 'Poured enamel',
		beschreibung: 'Opaque lapis enamel with cyan pooling and a wet sheen.',
		grundton: '#254cbd',
		pigment: 0,
		rauheit: 0.14,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'glas-klar',
		familie: 'glas',
		name: 'Clear glass',
		beschreibung: 'Clear neutral glazing reveals the interior and catches light at its edges.',
		grundton: '#f1faf6',
		pigment: 0,
		rauheit: 0.045,
		metall: 0,
		transmission: 0.98
	},
	{
		id: 'glas-matt',
		familie: 'glas',
		name: 'Etched glass',
		beschreibung: 'Neutral etched glazing softens the same interior.',
		grundton: '#ebf1eb',
		pigment: 0,
		rauheit: 0.44,
		metall: 0,
		transmission: 0.9
	},
	{
		id: 'holz-natur',
		familie: 'holz',
		name: 'Natural timber',
		beschreibung: 'Long grain along local x; cut ends reveal irregular growth rings.',
		grundton: '#f1c697',
		pigment: 0.32,
		rauheit: 0.52,
		metall: 0,
		transmission: 0
	},
	{
		id: 'holz-gebeizt',
		familie: 'holz',
		name: 'Stained timber',
		beschreibung: 'Flow pigment stains the timber while its grain remains visible.',
		grundton: '#aa7e50',
		pigment: 0.72,
		rauheit: 0.43,
		metall: 0,
		transmission: 0
	},
	{
		id: 'holz-aufrecht',
		familie: 'holz',
		name: 'Upright timber',
		beschreibung: 'Vertical grain on the walls and broad growth rings on the exposed top.',
		grundton: '#f1c697',
		pigment: 0.32,
		rauheit: 0.52,
		metall: 0,
		transmission: 0
	},
	{
		id: 'membran-beschichtet',
		familie: 'membran',
		name: 'Coated membrane',
		beschreibung: 'Saturated ultramarine coated fabric with pale welded seams.',
		grundton: '#304cbc',
		pigment: 0.35,
		rauheit: 0.36,
		metall: 0,
		transmission: 0.065
	},
	{
		id: 'membran-gewebe',
		familie: 'membran',
		name: 'Woven membrane',
		beschreibung: 'Dry fibrous fabric with a fine crossing weave.',
		grundton: '#d9d0bb',
		pigment: 0.28,
		rauheit: 0.76,
		metall: 0,
		transmission: 0.12
	},
	{
		id: 'membran-opal',
		familie: 'membran',
		name: 'Opal film',
		beschreibung:
			'Pearlescent coated film shifts from violet to peach across the inflated surface.',
		grundton: '#cac0ed',
		pigment: 0,
		rauheit: 0.36,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'wasser-ruhig',
		familie: 'wasser',
		name: 'Shallow water',
		beschreibung: 'Clear blue water with slow crossing ripples above the basin floor.',
		grundton: '#53bde7',
		pigment: 0,
		rauheit: 0.065,
		metall: 0,
		transmission: 0.92
	},
	{
		id: 'bestand-matt',
		familie: 'bestand',
		name: 'White stock',
		beschreibung: 'Pale matte stock, understated seams and no flow pigment.',
		grundton: '#eeece6',
		pigment: 0,
		rauheit: 0.94,
		metall: 0,
		transmission: 0
	},
	{
		id: 'keramik-orange-blau',
		familie: 'keramik',
		name: 'Amber and cobalt glaze',
		beschreibung: 'Two fired pigments meet across a glossy surface.',
		grundton: '#ed812b',
		pigment: 0,
		rauheit: 0.18,
		metall: 0,
		transmission: 0
	},
	{
		id: 'perforated-metal',
		familie: 'metall',
		name: 'Perforated sheet',
		beschreibung: 'Open round punches expose the body behind the sheet.',
		grundton: '#b4b9bc',
		pigment: 0.8,
		rauheit: 0.38,
		metall: 0.55,
		transmission: 0
	},
	{
		id: 'pressed-chipboard',
		familie: 'holz',
		name: 'Pressed chipboard',
		beschreibung: 'Crossing timber flakes in a warm pressed binder.',
		grundton: '#ccab81',
		pigment: 0.35,
		rauheit: 0.68,
		metall: 0,
		transmission: 0
	},
	{
		id: 'clear-acrylic',
		familie: 'kunststoff',
		name: 'Clear acrylic',
		beschreibung: 'Polished acrylic with a soft body tint and clear edges.',
		grundton: '#cfe6e0',
		pigment: 0.65,
		rauheit: 0.095,
		metall: 0,
		transmission: 0.93
	},
	{
		id: 'corrugated-metal',
		familie: 'metall',
		name: 'Corrugated sheet metal',
		beschreibung: 'Pressed parallel ribs at a 0.39 metre pitch run across a satin metal skin.',
		grundton: '#b8bdbc',
		pigment: 0.72,
		rauheit: 0.52,
		metall: 0.27,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'planted-mat',
		familie: 'membran',
		name: 'Planted roof mat',
		beschreibung: 'Low leaves form irregular patches across a backed planting blanket.',
		grundton: '#769266',
		pigment: 0.64,
		rauheit: 0.92,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	...referenzAusfuehrungen
];
