import { surfaceRecipe } from './surface-recipe';

export const ceramicGlaze = surfaceRecipe('ceramic-glaze', {
	'porcelain-dip': { finish: 'keramik-glasiert', token: '--cat-health', material: 'glaze' },
	'amber-dip': { finish: 'keramik-glasiert', token: '--cat-mobility', material: 'glaze' },
	checker: { finish: 'keramik-schachbrett', token: '--paper', material: 'glaze' }
});
