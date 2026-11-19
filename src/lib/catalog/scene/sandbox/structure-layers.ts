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
	if (part.kind === 'box')
		return (
			part.material !== 'glaze' && ['--cat-business-2', '--cat-business-3'].includes(part.token)
		);
	return (
		part.kind === 'prism' &&
		part.material === 'concrete' &&
		part.token === '--cat-business' &&
		!part.id.includes(':tread:')
	);
}
function isCasting(part: Primitive) {
	return (
		part.material === 'glaze' &&
		!part.glass &&
		['box', 'capsule', 'cylinder', 'sphere', 'torus', 'ring'].includes(part.kind)
	);
}
function layerOf(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (isStructural(part)) return 'carriers';
	if (part.role !== 'neu') return 'regular';
	if (isConduit(part)) return 'conduits';
	if (isAccent(part) && isInlay(part)) return 'inlays';
	if (isCasting(part)) return 'ceramics';
	return isAccent(part) ? 'accents' : 'regular';
}
/** Selects each projected surface and applies the city-scale contour threshold before batching. */
export function partition(primitives: Primitive[], unoutlined: ReadonlySet<Primitive>) {
	const parts = {
		regular: [] as Primitive[],
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
		const layer = layerOf(part);
		const body: Primitive = part.envelope ? { ...part, role: 'neu', glass: false } : part;
		if (unoutlined.has(original) && layer !== 'carriers' && layer !== 'ghosts') {
			parts[isAccent(part) ? 'plainAccents' : 'plain'].push({ ...body, edges: false });
		} else if (part !== original) parts.portals.push(body);
		else parts[layer].push(body);
	}
	return parts;
}
