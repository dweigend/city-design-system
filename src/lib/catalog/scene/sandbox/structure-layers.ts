import { isStructural, type Primitive } from '../../logic/parametrik/types';
import { collageCut } from './collage-cut';
import { hasFinish, type Surface } from './finish-batch';
import { hasGlazeContour } from './structure-outline';
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
function isPaperGlaze(part: Primitive): part is Extract<Primitive, { kind: 'mesh' }> {
	return (
		part.kind === 'mesh' &&
		part.role === 'neu' &&
		!isStructural(part) &&
		part.material === 'glaze' &&
		part.token === '--paper'
	);
}

function newSurface(part: Primitive) {
	if (part.kind === 'capsule' && part.printBand) return 'pods';
	if (part.kind === 'prism' && part.topToken) return 'drawers';
	return accentSurface(part);
}

function accentSurface(part: Primitive) {
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

function surfaceBody(part: Primitive): Primitive {
	return part.envelope ? { ...part, role: 'neu', glass: false } : part;
}

function drawingLayer(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (part.role === 'bestand' || part.planned) return isStructural(part) ? 'carriers' : 'regular';
}

const keepLayer = new Set(['carriers', 'ghosts']);
/** Selects each projected surface and applies the city-scale contour threshold before batching. */
export function partition(
	primitives: Primitive[],
	unoutlined: ReadonlySet<Primitive>,
	city = false
) {
	const parts = {
		finished: [] as Surface[],
		unoutlinedFinishes: [] as Surface[],
		regular: [] as Primitive[],
		pods: [] as Primitive[],
		plainPods: [] as Primitive[],
		drawers: [] as Primitive[],
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
	const plainIds = new Set([...unoutlined].map((p) => p.id));
	for (const original of primitives) {
		const drawing = drawingLayer(original);
		if (drawing) {
			parts[drawing].push(drawing === 'regular' ? { ...original, role: 'bestand' } : original);
			continue;
		}
		const finish = finishedSurface(original, city);
		if (finish) {
			const surfaces =
				unoutlined.has(original) && hasGlazeContour(finish.finish)
					? parts.unoutlinedFinishes
					: parts.finished;
			surfaces.push(finish);
			continue;
		}

		addSurface(original);
	}
	return parts;

	function addSurface(original: Primitive) {
		const part = collageCut(original);
		const body = surfaceBody(part);
		const layer = layerOf(part);
		if (part.overprint)
			parts[plainIds.has(part.id.split(':overprint:')[0]) ? 'plain' : 'regular'].push(body);
		else if (unoutlined.has(original) && layer === 'pods') parts.plainPods.push(body);
		else if (unoutlined.has(original) && !keepLayer.has(layer))
			parts[isAccent(part) ? 'plainAccents' : 'plain'].push({ ...body, edges: false });
		else parts[part === original ? layer : 'portals'].push(body);
	}
}

function finishedSurface(part: Primitive, city: boolean): Surface | undefined {
	if (hasFinish(part)) return part;
	const fallback = city && citySurface(part);
	if (fallback) return fallback;
	if (isPaperGlaze(part) && !part.overprint) return { ...part, finish: 'glaze' };
}

function citySurface(part: Primitive): Surface | undefined {
	if (part.kind === 'capsule') return { ...part, finish: 'acryl-matt' };
	if (
		(part.kind === 'membrane' && part.cityForm) ||
		(part.kind === 'prism' && (part.bearing === 'slab' || part.id.endsWith(':deck')))
	)
		return { ...part, finish: 'print-terrazzo' };
}
