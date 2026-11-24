import { joinSettings, settingValues } from '../setting';
import { bondFamilies } from './bond';
import { budgets } from './budgets';
import { controls } from './controls';
import { otherFamilies } from './families';
import { plate } from './plate';

/** Numeric settings and their provenance. */
export const settings = joinSettings(bondFamilies, otherFamilies, budgets, controls, plate);

/** Frozen defaults consumed by domain/material. */
export const materialSettings = settingValues(settings);
