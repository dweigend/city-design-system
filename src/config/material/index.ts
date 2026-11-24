import { joinSettings, settingValues } from '../setting';
import { bondFamilies } from './bond';
import { budgets } from './budgets';
import { controls } from './controls';
import { otherFamilies } from './families';

/** Numeric settings and their provenance. */
export const settings = joinSettings(bondFamilies, otherFamilies, budgets, controls);

/** Frozen defaults consumed by scene/material. */
export const materialSettings = settingValues(settings);
