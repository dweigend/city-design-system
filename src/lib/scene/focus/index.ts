/** Module: Resolves the display level of each subsystem from a focus choice. */
import type { SurfaceLevel } from '../material';

/** The five display levels of COLOR-6, from the subject to the omitted context. */
export const displayLevels = Object.freeze([
	'full',
	'silhouette',
	'transparent',
	'pencil',
	'hidden'
] as const);

/** One way to draw a subsystem: full detail and colour, a plain neutral box, a see-through
 * envelope, a pencil drawing, or nothing. */
export type DisplayLevel = (typeof displayLevels)[number];

/** Share of the stock drawn in pencil (COLOR-5). */
export { stockPencilShare } from './constants';

/** Menu label, the subsystems a choice highlights, and an optional analysis mode. */
export type FocusOption = Readonly<{
	label: string;
	subject: readonly string[];
	analysis?: string;
}>;

/** A preset is missing a subsystem or a display level in its vocabulary. */
export class FocusPolicyError extends Error {
	override name = 'FocusPolicyError';
}

/** Compiles a page's ordered vocabulary and contributed rows into a detached resolver.
 * Validates required and subject rows, and one display level per choice, at construction.
 * An unknown subsystem supplied later also throws FocusPolicyError. */
export function createFocusResolver<const Choice extends string, const Part extends string>(
	vocabulary: Readonly<Record<Choice, FocusOption>>,
	rows: Readonly<Record<Part, Readonly<Record<Choice, DisplayLevel>>>>,
	required: readonly string[] = Object.keys(rows)
) {
	const choices = Object.freeze(Object.keys(vocabulary) as Choice[]);
	const subsystems = Object.freeze(Object.keys(rows) as Part[]);
	const options = new Map(
		choices.map((choice) => {
			const option = vocabulary[choice];
			return [choice, { ...option, subject: [...option.subject] }] as const;
		})
	);
	const policy = new Map<string, Readonly<Record<Choice, DisplayLevel>>>(
		subsystems.map((part) => [part, { ...rows[part] }])
	);

	function readRow(part: string) {
		const row = policy.get(part);
		if (!row) throw new FocusPolicyError(`Missing focus row for "${part}"`);
		return row;
	}

	for (const part of required) readRow(part);
	for (const { subject } of options.values()) for (const part of subject) readRow(part);
	for (const [part, row] of policy)
		for (const choice of choices)
			if (!displayLevels.includes(row[choice]))
				throw new FocusPolicyError(
					`Missing or invalid focus level for "${part}" under "${choice}"`
				);

	const resolver = {
		choices,
		subsystems,
		/** Reads one display level. An unknown choice throws RangeError. */
		readFocusLevel(choice: Choice, part: string): DisplayLevel {
			if (!options.has(choice)) throw new RangeError(`Unknown focus "${choice}"`);
			return readRow(part)[choice];
		},
		/** Reads a choice's label and analysis mode. An unknown choice throws RangeError. */
		readFocusChoice(choice: Choice) {
			const option = options.get(choice);
			if (!option) throw new RangeError(`Unknown focus "${choice}"`);
			return { label: option.label, analysis: option.analysis };
		},
		/** Offers choices with a present subject, dropping duplicate drawings in menu order. */
		offerFocus(present: readonly string[]): Choice[] {
			const presentRows = present.map(readRow);
			const seen = new Set<string>();
			const offered: Choice[] = [];
			for (const [choice, { subject, analysis }] of options) {
				if (subject.length && !subject.some((part) => present.includes(part))) continue;
				const key = JSON.stringify([analysis, presentRows.map((row) => row[choice])]);
				if (seen.has(key)) continue;
				seen.add(key);
				offered.push(choice);
			}
			return offered;
		}
	};
	return Object.freeze({
		...resolver,
		/** Selects the requested offered choice, the offered fallback, or the first menu entry. */
		selectFocus(present: readonly string[], requested: Choice | undefined, fallback: Choice) {
			const offered = resolver.offerFocus(present);
			const active =
				requested && offered.includes(requested)
					? requested
					: offered.includes(fallback)
						? fallback
						: (offered[0] ?? fallback);
			return {
				items: offered.map((value) => ({ value, label: resolver.readFocusChoice(value).label })),
				active,
				analysis: resolver.readFocusChoice(active).analysis,
				readLevel: (part: string) => resolver.readFocusLevel(active, part)
			};
		}
	});
}

const surfaceDetail = {
	full: 'relief',
	silhouette: 'flat',
	transparent: 'flat',
	pencil: 'pencil',
	hidden: undefined
} as const satisfies Record<DisplayLevel, SurfaceLevel | undefined>;

/** Maps focus display to surface detail. Hidden surfaces can be skipped. */
export function readSurfaceLevel(level: DisplayLevel): SurfaceLevel | undefined {
	if (!Object.hasOwn(surfaceDetail, level))
		throw new RangeError(`Unknown display level "${level}"`);
	return surfaceDetail[level];
}
