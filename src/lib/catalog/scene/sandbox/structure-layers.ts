import { isStructural, type Primitive } from '../../logic/parametrik/types';
import { collageCut } from './collage-cut';
const isAccent = (part: Primitive) =>
	part.role === 'neu' && !part.envelope && part.token.startsWith('--cat-');

function isConduit(part: Primitive) {
	return (
		part.kind === 'pipe' &&
		(['--cat-health', '--cat-mobility'].includes(part.token) ||
			(part.token === '--cat-business' && part.id.endsWith('/deck')))
	);
}
function isInlay(part: Primitive) {
	return (
		(part.kind === 'prism' && part.id.endsWith(':figure:garden')) ||
		(part.kind === 'box' && part.material !== 'glaze' && part.token === '--cat-business-2')
	);
}
function isCasting(part: Primitive) {
	return (
		part.material === 'glaze' &&
		!part.glass &&
		['box', 'capsule', 'cylinder', 'sphere', 'torus', 'ring'].includes(part.kind)
	);
}
function newSurface(part: Primitive) {
	if (part.kind === 'mesh' && part.material === 'glaze' && part.token === '--paper') return 'glaze';
	if (isConduit(part)) return 'conduits';
	if (isInlay(part) && isAccent(part)) return 'inlays';
	if (isCasting(part)) return 'ceramics';
	return isAccent(part) ? 'accents' : 'regular';
}

function layerOf(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (isStructural(part)) return 'carriers';
	return part.role === 'neu' ? newSurface(part) : 'regular';
}

const keepLayer = new Set(['carriers', 'ghosts', 'glaze']);
/** Selects each projected surface and applies the city-scale contour threshold before batching. */
export function partition(primitives: Primitive[], unoutlined: ReadonlySet<Primitive>) {
	const parts = {
		regular: [] as Primitive[],
		glaze: [] as Primitive[],
		plain: [] as Primitive[],
		plainAccents: [] as Primitive[],
		carriers: [] as Primitive[],
		ceramics: [] as Primitive[],
		inlays: [] as Primitive[],
		portals: [] as Primitive[],
		conduits: [] as Primitive[],
		accents: [] as Primitive[],
		ghosts: [] as Primitive[]
	};
	for (const original of primitives) {
		const part = collageCut(original);
		const body: Primitive = part.envelope ? { ...part, role: 'neu', glass: false } : part;
		const layer = layerOf(part);
		if (unoutlined.has(original) && !keepLayer.has(layer))
			parts[isAccent(part) ? 'plainAccents' : 'plain'].push({ ...body, edges: false });
		else parts[part === original ? layer : 'portals'].push(body);
	}
	return parts;
}
