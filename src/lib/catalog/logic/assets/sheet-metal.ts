import { surfaceRecipe } from './surface-recipe';

export const sheetMetal = surfaceRecipe('sheet-metal', {
	brushed: { finish: 'metall-gebuerstet', token: '--paper', material: 'metal' },
	graphite: { finish: 'metall-graphit', token: '--paper', material: 'metal' },
	enamel: { finish: 'metall-lackiert', token: '--cat-living', material: 'metal' }
});
