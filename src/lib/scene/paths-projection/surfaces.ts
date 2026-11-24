import { defaults } from '../../../config/paths-projection';
import type { Surface } from '../surface';

const pink = '--path';
const deepPink = '--cat-business-5';
const brass = '--cat-mobility';
const darkBrass = '--cat-mobility-5';

// Exact arithmetic: unity opacity keeps the stroke color opaque.
function stroke(color: Surface['color'], width: number): Surface {
	return { color, finish: 'matte', stroke: { color, width, opacity: 1 } };
}

export const pathSurfaces = {
	lane: stroke(pink, defaults.groundStrokePx),
	deck: stroke(pink, defaults.deckStrokePx),
	support: { color: pink, finish: 'matte' },
	route: stroke(deepPink, defaults.routeStrokePx),
	rail: stroke(brass, defaults.railStrokePx),
	track: stroke(darkBrass, defaults.trackStrokePx),
	pier: { color: darkBrass, finish: 'matte' },
	station: { color: brass, finish: 'matte' }
} as const satisfies Record<string, Surface>;
