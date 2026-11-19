import { isStructural, type Primitive } from '../../logic/parametrik/types';
import { collageCut, printPortal } from './collage-cut';
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
function layerOf(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (isStructural(part)) return 'carriers';
	if (part.role !== 'neu') return 'regular';
	if (part.kind === 'mesh' && part.material === 'glaze' && part.token === '--paper') return 'glaze';
	if (isConduit(part)) return 'conduits';
	if (isAccent(part) && isInlay(part)) return 'inlays';
	if (isCasting(part)) return 'ceramics';
	return isAccent(part) ? 'accents' : 'regular';
}
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
	const figures = new Map<string, Primitive['token']>();
	for (const p of primitives)
		if (p.role === 'neu' && p.id.includes(':figure') && p.token.startsWith('--cat-'))
			figures.set(p.id.split(':figure')[0], p.token);
	for (const original of primitives) {
		const part = collageCut(original);
		const layer = layerOf(part);
		const body: Primitive = part.envelope ? { ...part, role: 'neu', glass: false } : part;
		if (
			unoutlined.has(original) &&
			layer !== 'carriers' &&
			layer !== 'ghosts' &&
			layer !== 'glaze'
		) {
			parts[isAccent(part) ? 'plainAccents' : 'plain'].push({ ...body, edges: false });
		} else if (part !== original && part.kind === 'mesh') {
			const pigment = figures.get(part.id.replace(/:stock$/, ''));
			if (pigment) {
				const panel = printPortal(part, pigment);
				parts.inlays.push(panel.face);
				parts.portals.push(panel.returns);
			} else parts.portals.push(body);
		} else parts[layer].push(body);
	}
	return parts;
}
