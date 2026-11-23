import { joinSettings, settingValues } from '../setting';
import { terraces } from './terraces';
import { guide } from './guide';
import { parameters } from './parameters';
import { regional } from './regional';
import { surface } from './surface';
import { drainage } from './drainage';
import { uplift } from './uplift';

/** Hydrology settings and their provenance. */
export const settings = joinSettings(
	terraces,
	guide,
	parameters,
	regional,
	surface,
	drainage,
	uplift
);

/** Frozen defaults consumed by the valley module. */
export const defaults = settingValues(settings);
