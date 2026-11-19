import { surfaceRecipe } from './surface-recipe';

export const terrazzo = surfaceRecipe('terrazzo', {
	'chalk-chip': { finish: 'beton-terrazzo', token: '--paper', material: 'concrete' },
	'water-chip': { finish: 'beton-terrazzo', token: '--cat-health', material: 'concrete' },
	'sage-chip': { finish: 'beton-terrazzo', token: '--cat-nature', material: 'concrete' }
});
