import { surfaceRecipe } from './surface-recipe';

export const corrugated = surfaceRecipe('corrugated', {
	zinc: { finish: 'corrugated-metal', token: '--paper', material: 'metal' },
	'coated-water': { finish: 'corrugated-metal', token: '--cat-health', material: 'metal' },
	'workshop-panel': { finish: 'corrugated-metal', token: '--cat-living', material: 'metal' }
});
