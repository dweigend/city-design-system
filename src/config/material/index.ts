import { joinSettings, settingValues } from '../setting';
import { bondFamilies } from './bond';
import { budgets } from './budgets';
import { controls } from './controls';
import { otherFamilies } from './families';
import { samples } from './samples';

/** Numeric settings and their provenance. */
export const settings = joinSettings(bondFamilies, otherFamilies, budgets, samples, controls);

/** Frozen defaults consumed by scene/material. */
export const materialSettings = settingValues(settings);
