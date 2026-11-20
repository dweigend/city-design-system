import type { BandAccent } from './surfaces';
import type { Section } from './types';

const GROUND_ACCENT: string[] = ['bell-house', 'plinth-house', 'block'];
function accentStorey(section: Section) {
	const levels = section.composition.levels;
	// A compact block already colours the window band and door of its ground body: that body is the
	// accent body, so the house keeps exactly one.
	if (GROUND_ACCENT.includes(section.typology)) return 0;
	if (levels.length > 3) return levels.length - 1;
	return Math.floor(levels.length / 2);
}
const bodyCount = (section: Section) =>
	section.composition.levels.reduce((n, l) => n + l.bodies.length, 0);
/** The one body of a house that carries its programme colour: the first body of the accent storey. */
export function accentBody(section: Section) {
	return section.composition.levels[accentStorey(section)].bodies[0];
}
/** True for the high point of an ensemble of at least two houses. A standalone house is not one. */
export function ensembleAnchor(section: Section) {
	const { role, ensembleSize } = section.composition;
	return role === 'high' && ensembleSize >= 2 && bodyCount(section) >= 2;
}
/** The ensemble anchor paints its accent body whole. Every other house keeps a small accent whose
 * size follows the number of bodies, not of storeys. */
export function accentKind(section: Section): BandAccent {
	if (ensembleAnchor(section)) return 'anchor';
	const bodies = bodyCount(section);
	if (bodies === 1) return 'window';
	return bodies > 3 ? 'storey' : 'wall';
}
