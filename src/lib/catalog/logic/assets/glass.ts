import { surfaceRecipe } from './surface-recipe';

export const glass = surfaceRecipe('glass', {
	clear: { finish: 'glas-klar', token: '--paper', material: 'glass' },
	etched: { finish: 'glas-matt', token: '--paper', material: 'glass' },
	'solar-laminate': { finish: 'glas-photovoltaik', token: '--cat-health', material: 'glass' }
});
