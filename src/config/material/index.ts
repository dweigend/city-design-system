import { joinSettings, settingValues } from '../setting';
import { budgets } from './budgets';
import { controls } from './controls';
import { patterns } from './patterns';
import { plate } from './plate';

/** Numeric settings and their provenance. */
export const settings = joinSettings(patterns, budgets, controls, plate);

/** Frozen defaults consumed by domain/material. */
export const materialSettings = settingValues(settings);

/** What each surface level draws. */
export { surfaceLevelTable } from './levels';
