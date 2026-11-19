import type { AssetRecipe } from './definition';
import { porthole } from './porthole';
import { windowBand } from './window-band';

export const recipes: readonly AssetRecipe[] = [porthole, windowBand];
