import type { AssetRecipe } from './definition';
import { porthole } from './porthole';
import { windowBand } from './window-band';
import { balcony } from './balcony';

export const recipes: readonly AssetRecipe[] = [porthole, windowBand, balcony];
