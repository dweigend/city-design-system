import type { AssetRecipe } from './definition';
import { porthole } from './porthole';
import { windowBand } from './window-band';
import { balcony } from './balcony';
import { bayWindow } from './bay-window';
import { louvres } from './louvres';
import { shippingContainer } from './shipping-container';

export const recipes: readonly AssetRecipe[] = [
	porthole,
	windowBand,
	balcony,
	bayWindow,
	louvres,
	shippingContainer
];
