import { surfaceRecipe } from './surface-recipe';

export const planted = surfaceRecipe('planted', {
	moss: { finish: 'planted-mat', token: '--paper', material: 'cork' },
	sedum: { finish: 'planted-mat', token: '--cat-nature', material: 'cork' },
	sage: { finish: 'planted-mat', token: '--cat-nature-2', material: 'cork' }
});
