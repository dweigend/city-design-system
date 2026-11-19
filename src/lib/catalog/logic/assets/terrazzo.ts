import { surfaceRecipe } from './surface-recipe';

export const terrazzo = surfaceRecipe('terrazzo', {
	'chalk-chip': { finish: 'print-terrazzo', token: '--paper', material: 'concrete' },
	'water-chip': { finish: 'print-terrazzo', token: '--cat-health', material: 'concrete' },
	'sage-chip': { finish: 'print-terrazzo', token: '--cat-nature', material: 'concrete' }
});
