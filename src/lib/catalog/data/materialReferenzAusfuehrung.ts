import type { Ausfuehrung } from './materialAusfuehrungTypen';

/** Additional studio finishes drawn from the architectural references. */
export const referenzAusfuehrungen: readonly Ausfuehrung[] = [
	{
		id: 'metall-messing',
		familie: 'metall',
		name: 'Polished brass',
		beschreibung: 'Gold-toned mirror metal makes each fold catch a different reflection.',
		grundton: '#edbb66',
		pigment: 0,
		rauheit: 0.098,
		metall: 1,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'metall-kupfer',
		familie: 'metall',
		name: 'Weathered copper',
		beschreibung: 'Warm reflective copper with brown oxide and traces of green patina.',
		grundton: '#d3825d',
		pigment: 0,
		rauheit: 0.24,
		metall: 0.88,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'keramik-schachbrett',
		familie: 'keramik',
		name: 'Checkerboard glaze',
		beschreibung:
			'Alternating charcoal and porcelain tiles with recessed grout and rounded shoulders.',
		grundton: '#f5f2e8',
		pigment: 0,
		rauheit: 0.18,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'kunststoff-gerippt',
		familie: 'kunststoff',
		name: 'Corrugated blue polymer',
		beschreibung: 'Colored polymer with rounded waves, pale crests and a satin finish.',
		grundton: '#246bc0',
		pigment: 0.45,
		rauheit: 0.34,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'beton-schaum',
		familie: 'beton',
		name: 'Lemon cellular concrete',
		beschreibung: 'A yellow mineral body with irregular open cells and sunlit pore rims.',
		grundton: '#e9d981',
		pigment: 0,
		rauheit: 0.87,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'beton-spritzer',
		familie: 'beton',
		name: 'Splatter-coated concrete',
		beschreibung: 'Cobalt splashes and yellow flecks sit slightly proud of pale cast concrete.',
		grundton: '#f1eee2',
		pigment: 0,
		rauheit: 0.66,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'kunststoff-marmoriert',
		familie: 'kunststoff',
		name: 'Clouded cast resin',
		beschreibung: 'Coral clouds and arctic-blue swirls extend through a milky cast polymer.',
		grundton: '#dce5e8',
		pigment: 0,
		rauheit: 0.32,
		metall: 0,
		transmission: 0.28
	},
	{
		id: 'glas-photovoltaik',
		familie: 'glas',
		name: 'Photovoltaic glass',
		beschreibung:
			'A smooth glass cover reveals blue cells, silver busbars and a fine collector grid.',
		grundton: '#294263',
		pigment: 0,
		rauheit: 0.17,
		metall: 0.15,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'membran-goldfolie',
		familie: 'membran',
		name: 'Crinkled gold foil',
		beschreibung: 'A metallized film scatters light across fine angular creases.',
		grundton: '#dcb35a',
		pigment: 0,
		rauheit: 0.29,
		metall: 0.88,
		transmission: 0,
		deckkraft: 1
	},
	{
		id: 'membran-flor',
		familie: 'membran',
		name: 'Cobalt pile fabric',
		beschreibung: 'Dense raised blue fibers form tufts with a soft grazing sheen.',
		grundton: '#259dd0',
		pigment: 0.33,
		rauheit: 0.78,
		metall: 0,
		transmission: 0,
		deckkraft: 1
	}
];
