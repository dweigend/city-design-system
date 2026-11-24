/** Module: Defines numeric parameter schemas and resolves player overrides. */
const {
	blockHeightDefaultM,
	blockHeightMinM,
	blockHeightMaxM,
	blockHeightStepM,
	blockWidthDefaultM,
	blockWidthMinM,
	blockWidthMaxM,
	blockWidthStepM,
	blockComplexityDefaultRatio,
	blockComplexityMinRatio,
	blockComplexityMaxRatio,
	blockComplexityStepRatio
} = defaults;

import { defaults } from '../../../config/inputs';

type NumberParam = Readonly<{
	label: string;
	unit: string;
	default: number;
	min: number;
	max: number;
	step: number;
}>;
/** A named table of numeric parameter metadata. */
export type ParameterSchema = Readonly<Record<string, NumberParam>>;
type DefinedSchema<S extends ParameterSchema> = { readonly [K in keyof S]: Readonly<S[K]> };
type Values<S extends ParameterSchema> = { readonly [K in keyof S]: number };

/** Validates numeric fields in their declared units and returns a detached, frozen schema.
 * Invalid metadata types throw TypeError. Invalid bounds, steps or defaults throw RangeError.
 * Leaves the source schema and fields untouched.
 */
export function defineParams<const S extends ParameterSchema>(schema: S): DefinedSchema<S> {
	const fields = Object.entries(schema).map(([key, field]) => {
		const { label, unit, min, max, step, default: value } = field;
		if (
			typeof label !== 'string' ||
			typeof unit !== 'string' ||
			![min, max, step, value].every((number) => typeof number === 'number')
		) {
			throw new TypeError(`Invalid metadata for parameter "${key}"`);
		}
		if (
			![min, max, step, value].every(Number.isFinite) ||
			step <= 0 ||
			min > max ||
			value < min ||
			value > max ||
			(max - min) / step > Number.MAX_SAFE_INTEGER
		) {
			throw new RangeError(`Invalid bounds, step or default for parameter "${key}"`);
		}
		return [key, Object.freeze({ ...field })];
	});
	// The mapping retains each input key and clones its field without changing its values.
	return Object.freeze(Object.fromEntries(fields)) as DefinedSchema<S>;
}

/** Returns detached numbers in schema order and units, using defaults for omitted keys.
 * Clamps supplied values to inclusive bounds, then snaps to the nearest step from min
 * in floating-point arithmetic (ties toward max), capped at max. Inputs stay untouched.
 * Unknown keys and non-numbers throw TypeError. Non-finite numbers throw RangeError.
 */
export function resolveParams<const S extends ParameterSchema>(
	schema: S,
	overrides: Partial<Values<NoInfer<S>>> = {}
): Values<S> {
	for (const key of Reflect.ownKeys(overrides)) {
		if (typeof key !== 'string' || !Object.hasOwn(schema, key)) {
			throw new TypeError(`Unknown parameter "${String(key)}"`);
		}
	}
	const values = Object.entries(schema).map(([key, { min, max, step, default: fallback }]) => {
		if (!Object.hasOwn(overrides, key)) return [key, fallback];
		const value = overrides[key];
		if (typeof value !== 'number') throw new TypeError(`Parameter "${key}" must be numeric`);
		if (!Number.isFinite(value)) throw new RangeError(`Parameter "${key}" must be finite`);
		const bounded = Math.max(min, Math.min(max, value));
		const snapped = min + Math.round((bounded - min) / step) * step;
		return [key, Math.min(max, snapped)];
	});
	// Each schema key contributes exactly one number.
	return Object.fromEntries(values) as Values<S>;
}

/** Shared block schema. Measure height and width in meters on the generated result's bounding
 * box, regardless of shape. Complexity is unitless. Reading the frozen schema has no side effects.
 */
export const blockInputs = defineParams({
	height: {
		label: 'Height',
		unit: 'm',
		default: blockHeightDefaultM,
		min: blockHeightMinM,
		max: blockHeightMaxM,
		step: blockHeightStepM
	},
	width: {
		label: 'Width',
		unit: 'm',
		default: blockWidthDefaultM,
		min: blockWidthMinM,
		max: blockWidthMaxM,
		step: blockWidthStepM
	},
	complexity: {
		label: 'Complexity',
		unit: '',
		default: blockComplexityDefaultRatio,
		min: blockComplexityMinRatio,
		max: blockComplexityMaxRatio,
		step: blockComplexityStepRatio
	}
});
