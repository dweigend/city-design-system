import { canLinkCrowns, type Bay } from './bearing-layout';

/** Roof indices follow sorted roof IDs. Row-major entries encode compatible bay pairs. */
export type RoofLink = { a: number; b: number; columns: number; pairs: Uint8Array };
function bounds(bays: Bay[]) {
	const points = bays.flatMap((b) => b.crown.map((n) => n.p));
	return {
		left: Math.min(...points.map((p) => p[0])),
		right: Math.max(...points.map((p) => p[0])),
		bottom: Math.min(...points.map((p) => p[1])),
		top: Math.max(...points.map((p) => p[1]))
	};
}
function spanGap(a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) {
	return Math.max(a.left - b.right, b.left - a.right, a.bottom - b.top, b.bottom - a.top);
}
function compatibility(a: Bay[], b: Bay[], span: number) {
	const pairs = new Uint8Array(a.length * b.length);
	for (let i = 0; i < a.length; i++)
		for (let j = 0; j < b.length; j++)
			pairs[i * b.length + j] = Number(canLinkCrowns(a[i], b[j], span));
	return pairs;
}
/** Builds the undirected span graph in ID order. A planar bounds gap can exclude a
 * roof pair; only actual compatible crown pairs create an edge. Inputs remain unchanged. */
export function roofLinks(options: Bay[][], span: number) {
	const boxes = options.map(bounds),
		edges: RoofLink[] = [];
	for (let a = 0; a < options.length; a++)
		for (let b = a + 1; b < options.length; b++) {
			if (spanGap(boxes[a], boxes[b]) > span) continue;
			const pairs = compatibility(options[a], options[b], span);
			if (pairs.includes(1)) edges.push({ a, b, columns: options[b].length, pairs });
		}
	return edges;
}
