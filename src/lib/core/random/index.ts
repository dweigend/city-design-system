const algorithm = 'mulberry32';
const revision = 'agent-loom-random/1';
const wordCount = 0x100000000;
const increment = 0x6d2b79f5;

/** Detached frozen unitless continuation. The uniform-only stream has an empty Gaussian cache. */
export type RandomState = Readonly<{
	algorithm: typeof algorithm;
	seed: number;
	continuation: Readonly<{
		algorithm: typeof algorithm;
		revision: typeof revision;
		word: number;
		gaussian: null;
	}>;
}>;

type CreateOptions = { seed?: number; algorithm?: typeof algorithm };
type UniformOptions = { distribution?: 'uniform'; min?: number; max?: number; integer?: boolean };

/** One independent, continuing Mulberry32 stream. All numeric inputs and draws are unitless. */
export interface Random {
	/** Fixed algorithm identifier. */
	readonly algorithm: typeof algorithm;
	/** Unsigned seed of the current stream. Reading does not draw. */
	readonly seed: number;
	/** Reads a frozen snapshot. Assign to restore atomically, without drawing. Invalid states throw TypeError or RangeError. */
	state: RandomState;
	/** Draws once from [min, max), default [0, 1). Integer mode requires safe integers. Invalid options throw TypeError or RangeError before drawing. */
	number(options?: UniformOptions): number;
	/** Returns one reference in a fresh array from a nonempty dense list, using one draw. Empty lists return [] without drawing. Invalid sources throw TypeError. Never mutates the source. */
	sample<T>(source: readonly T[]): T[];
	/** Returns an independent copy continuing from this position. Never draws or mutates this stream. */
	copy(): Random;
	/** Returns a fresh child using the owner seed and string key (UTF-16). Never draws or mutates this stream. Non-string keys throw TypeError. */
	derive(key: string): Random;
}

function optionsRecord(options: unknown, keys: readonly string[]): void {
	if (options === null || typeof options !== 'object' || Array.isArray(options)) {
		throw new TypeError('Expected an options object');
	}
	if (Object.keys(options).some((key) => !keys.includes(key))) {
		throw new TypeError('Unknown random option');
	}
}

function uint32(value: unknown, min = 0): number {
	if (typeof value !== 'number') throw new TypeError('Expected a numeric seed or state word');
	if (!Number.isInteger(value) || value < min || value >= wordCount) {
		throw new RangeError('Seed or state word is out of range');
	}
	return value >>> 0;
}

function nextDown(value: number): number {
	if (value === 0) return -Number.MIN_VALUE;
	const view = new DataView(new ArrayBuffer(8));
	view.setFloat64(0, value);
	view.setBigUint64(0, view.getBigUint64(0) + (value > 0 ? -1n : 1n));
	return view.getFloat64(0);
}

function uniformLimit(value: unknown): number {
	if (typeof value !== 'number') throw new TypeError('Uniform bounds must be numeric');
	if (!Number.isFinite(value)) throw new RangeError('Uniform bounds must be finite');
	return value;
}

function uniformBounds(options: UniformOptions) {
	optionsRecord(options, ['distribution', 'min', 'max', 'integer']);
	const { distribution = 'uniform', min: lower = 0, max: upper = 1, integer = false } = options;
	if (distribution !== 'uniform' || typeof integer !== 'boolean') {
		throw new TypeError('Invalid uniform options');
	}
	const min = uniformLimit(lower);
	const max = uniformLimit(upper);
	if (max <= min) throw new RangeError('Uniform bounds must be increasing');
	const span = max - min;
	if (integer && ![min, max, span].every(Number.isSafeInteger)) {
		throw new RangeError('Integer bounds and span must be safe integers');
	}
	return { min, max, span, integer };
}

function uniform(options: UniformOptions, draw: () => number): number {
	const { min, max, span, integer } = uniformBounds(options);
	const unit = draw();
	if (integer) return Math.min(max - 1, min + Math.floor(unit * span));
	const value = Number.isFinite(span) ? min + unit * span : (1 - unit) * min + unit * max;
	return Math.max(min, value < max ? value : nextDown(max));
}

// FNV-1a mixing over UTF-16 code units, starting from a seed-dependent offset.
function childSeed(seed: number, key: string): number {
	if (typeof key !== 'string') throw new TypeError('Expected a string child key');
	let hash = 0x811c9dc5 ^ seed;
	for (let index = 0; index < key.length; index += 1) {
		hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
	}
	return hash >>> 0;
}

function requireList(source: unknown): void {
	if (!Array.isArray(source)) throw new TypeError('Expected a sample list');
}

function stream(initialSeed: number): Random {
	let seed = initialSeed;
	let word = seed;
	function draw(): number {
		word = (word + increment) >>> 0;
		let value = Math.imul(word ^ (word >>> 15), word | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / wordCount;
	}

	const random: Random = {
		algorithm,
		get seed() {
			return seed;
		},
		get state(): RandomState {
			const continuation = Object.freeze({ algorithm, revision, word, gaussian: null });
			return Object.freeze({ algorithm, seed, continuation });
		},
		set state(value: RandomState) {
			if (
				value?.algorithm !== algorithm ||
				value.continuation?.algorithm !== algorithm ||
				value.continuation.revision !== revision ||
				value.continuation.gaussian !== null
			) {
				throw new TypeError('Expected a Mulberry32 continuation with an empty Gaussian cache');
			}
			const restoredSeed = uint32(value.seed, -0x80000000);
			const restoredWord = uint32(value.continuation.word);
			seed = restoredSeed;
			word = restoredWord;
		},
		number(options = {}) {
			return uniform(options, draw);
		},
		sample<T>(source: readonly T[]): T[] {
			requireList(source);
			if (source.length === 0) return [];
			return [source[Math.floor(draw() * source.length)]];
		},
		copy() {
			const result = stream(seed);
			result.state = random.state;
			return result;
		},
		derive(key) {
			return stream(childSeed(seed, key));
		}
	};
	return Object.freeze(random);
}

/** Creates a fresh stream without drawing or mutating options. Defaults to seed 1. Invalid seed/options throw RangeError or TypeError. */
function create(options: CreateOptions = {}): Random {
	optionsRecord(options, ['seed', 'algorithm']);
	const { seed = 1, algorithm: selected = algorithm } = options;
	if (selected !== algorithm) throw new TypeError('Expected the Mulberry32 algorithm');
	return stream(uint32(seed, -0x80000000));
}

/** Frozen factory namespace for the uniform-only Mulberry32 stream. */
export const Random = Object.freeze({ create });
