type Field = Readonly<{
	type: 'number' | 'integer';
	label: string;
	unit: string;
	default: number;
	min: number;
	max: number;
	step: number;
}>;

type Schema = Readonly<Record<string, Field>>;
type Values<S extends Schema> = { readonly [K in keyof S]: number };
export type ParamOverrides<S extends Schema> = Partial<Values<S>>;

/** Describes a numeric control with inclusive bounds and a UI increment in the given unit. */
export function numberParam(
	label: string,
	unit: string,
	value: number,
	[min, max, step]: readonly [number, number, number],
	type: Field['type'] = 'number'
): Field {
	return { type, label, unit, default: value, min, max, step };
}

function validateValue(key: string, field: Field, value: number): number {
	if (!Number.isFinite(value) || value < field.min || value > field.max)
		throw new RangeError(`Parameter "${key}" must be finite and in [${field.min}, ${field.max}]`);
	if (field.type === 'integer' && !Number.isInteger(value))
		throw new RangeError(`Parameter "${key}" must be an integer`);
	return value;
}

/** Validates numeric metadata and defaults, then returns a detached, frozen schema.
 * Bounds are inclusive. The step is positive and applies to controls, not to resolution.
 */
export function defineParams<const S extends Schema>(schema: S): Readonly<S> {
	const fields = Object.entries(schema).map(([key, field]) => {
		if (!['number', 'integer'].includes(field.type))
			throw new RangeError(`Invalid parameter type for "${key}"`);
		if (![field.min, field.max, field.step].every(Number.isFinite) || field.step <= 0)
			throw new RangeError(`Invalid parameter bounds or step for "${key}"`);
		validateValue(key, field, field.default);
		return [key, Object.freeze({ ...field })];
	});
	return Object.freeze(Object.fromEntries(fields));
}

/** Returns detached numeric values. Caller fields override epoch fields, which override defaults.
 * Undefined inherits the previous layer. Unknown keys and invalid effective values throw RangeError.
 */
export function resolveParams<const S extends Schema>(
	schema: S,
	epochOverrides?: ParamOverrides<NoInfer<S>>,
	callerOverrides?: ParamOverrides<NoInfer<S>>
): Values<S> {
	for (const key of [...Object.keys(epochOverrides ?? {}), ...Object.keys(callerOverrides ?? {})]) {
		if (!Object.hasOwn(schema, key)) throw new RangeError(`Unknown parameter "${key}"`);
	}
	const valueAt = (layer: ParamOverrides<S> | undefined, key: string) =>
		layer && Object.hasOwn(layer, key) ? layer[key] : undefined;
	return Object.fromEntries(
		Object.entries(schema).map(([key, field]) => {
			const epoch = valueAt(epochOverrides, key);
			const caller = valueAt(callerOverrides, key);
			const inherited = epoch === undefined ? field.default : epoch;
			return [key, validateValue(key, field, caller === undefined ? inherited : caller)];
		})
	);
}
