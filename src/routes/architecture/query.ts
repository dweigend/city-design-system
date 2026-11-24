import { blockInputs, resolveParams } from '../../lib/core/params';
import { houseStyles, type HouseStyleName } from '../../lib/domain/house-court';
import { displayLevels, type DisplayLevel } from '../../lib/scene/focus';
import { parcelShapes, type ParcelShape } from './parcels';
import { sheets, type HouseSetup, type SheetName } from './sheets';

const pickKey = <K extends string>(
	table: Readonly<Record<K, unknown>>,
	value: string | null,
	fallback: K
): K => (value !== null && Object.hasOwn(table, value) ? (value as K) : fallback);

const number = (query: Pick<URLSearchParams, 'get' | 'has'>, key: string) => {
	const value = Number(query.get(key));
	return query.has(key) && Number.isFinite(value) ? value : undefined;
};

/** Reads the chapter state from the address, keeping only known keys and valid values. */
export function readQuery(query: Pick<URLSearchParams, 'get' | 'has'>) {
	const inputs = resolveParams(blockInputs, {
		height: number(query, 'height') ?? 14,
		width: number(query, 'width') ?? 28,
		complexity: number(query, 'complexity') ?? 0.6
	});
	const seed = number(query, 'seed');
	const levels = Object.fromEntries(displayLevels.map((level) => [level, true])) as Record<
		DisplayLevel,
		true
	>;
	const setup: HouseSetup = {
		...inputs,
		shape: pickKey<ParcelShape>(parcelShapes, query.get('shape'), 'rectangle'),
		style: pickKey<HouseStyleName>(houseStyles, query.get('style'), 'memphis'),
		level: pickKey<DisplayLevel>(levels, query.get('level'), 'full'),
		seed: seed !== undefined && Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32 ? seed : 3
	};
	const sheetNames = { one: true, town: true, ...sheets };
	return {
		setup,
		block: query.get('block') === 'merged' ? ('merged' as const) : ('block' as const),
		sheet: pickKey<SheetName | 'one' | 'town'>(sheetNames, query.get('sheet'), 'one'),
		bearing: number(query, 'bearing') ?? 212,
		elevation: number(query, 'elevation') ?? 36,
		view: query.get('view') === 'plan' ? ('plan' as const) : ('iso' as const)
	};
}
