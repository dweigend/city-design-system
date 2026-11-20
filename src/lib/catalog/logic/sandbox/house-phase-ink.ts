import { privateSurface } from '../walkway-network';
import { sandboxGenerationYears } from '../../data/sandbox';
import type { Primitive } from '../parametrik/types';
import { present, type Focus } from '../presentation';

type Build = Readonly<{ built: number; painted: boolean }>;
const TINT_PER_GENERATION = 0.06;
const MAX_AGE_TINT = 0.18;

/** Recognizes an edited story by its action ID; action zero belongs to the seeded town. */
export const isPainted = (id: string): boolean => !id.startsWith('p/0/');

/** Selects painted work in the sandbox, or the explicit build-year range on a study plate. */
export function isColourBuild(phase: Build, earliestFullYear?: number): boolean {
	return earliestFullYear === undefined ? phase.painted : phase.built >= earliestFullYear;
}

// The grammar can draw fragments as stock. Painted volumes keep their colour, while
// drafted line details retain the stroke weight set by the grammar.
const newVolume = (part: Primitive): Primitive =>
	part.role === 'bestand' && part.kind !== 'polyline'
		? { ...part, role: 'neu', edges: part.edges ?? true }
		: part;

/** Projects the phase's ink, with at most three generation steps toward the paper tone. */
export function presentHouseGroup(
	parts: Primitive[],
	phase: Build,
	year: number,
	focus: Focus,
	earliestFullYear?: number,
	publicDeckPalette = false
): Primitive[] {
	if (!isColourBuild(phase, earliestFullYear)) return present(parts, focus.stock);
	if (publicDeckPalette) parts = parts.map(privateSurface);
	const forms = present(parts.map(newVolume), focus.houses);
	// Fixed study plates keep their original ink.
	if (earliestFullYear !== undefined || focus.houses !== 'full') return forms;
	const generations = Math.floor((year - phase.built) / sandboxGenerationYears);
	if (generations <= 0) return forms;
	const ageTint = Math.min(MAX_AGE_TINT, generations * TINT_PER_GENERATION);
	return forms.map((part) => (part.role === 'neu' ? { ...part, ageTint } : part));
}
