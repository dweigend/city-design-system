import type { AssetRecipe } from './definition';
import { porthole } from './porthole';
import { windowBand } from './window-band';
import { balcony } from './balcony';
import { bayWindow } from './bay-window';
import { louvres } from './louvres';
import { shippingContainer } from './shipping-container';
import { livingCapsule } from './living-capsule';
import { tankCapsule } from './tank-capsule';
import { dome } from './dome';
import { barrelVault } from './barrel-vault';
import { sawtooth } from './sawtooth';
import { solarRoof } from './solar-roof';
import { greenRoof } from './green-roof';

export const recipes: readonly AssetRecipe[] = [
	porthole,
	windowBand,
	balcony,
	bayWindow,
	louvres,
	shippingContainer,
	livingCapsule,
	tankCapsule,
	dome,
	barrelVault,
	sawtooth,
	solarRoof,
	greenRoof
];
