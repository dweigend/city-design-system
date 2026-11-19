import { surfaceRecipe } from './surface-recipe';

export const ceramicGlaze = surfaceRecipe('ceramic-glaze', {
	'porcelain-dip': { finish: 'glaze', token: '--cat-health', material: 'glaze' },
	'amber-dip': { finish: 'glaze', token: '--cat-mobility', material: 'glaze' },
	checker: { finish: 'keramik-schachbrett', token: '--paper', material: 'glaze' }
});
