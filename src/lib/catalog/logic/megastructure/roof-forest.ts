import type { RoofLink } from './roof-links';

/** Kruskal forest. Links between preferred bays come first, then sorted endpoint IDs.
 * Component labels are local; the returned components contain the original roof indices. */
export function spanForest(count: number, edges: RoofLink[]) {
	const labels = Array.from({ length: count }, (_, i) => i),
		tree: RoofLink[] = [],
		chords: RoofLink[] = [];
	const sorted = [...edges].sort((x, y) => y.pairs[0] - x.pairs[0] || x.a - y.a || x.b - y.b);
	for (const edge of sorted) {
		const a = labels[edge.a],
			b = labels[edge.b];
		if (a === b) {
			chords.push(edge);
			continue;
		}
		tree.push(edge);
		for (let i = 0; i < count; i++) if (labels[i] === b) labels[i] = a;
	}
	const groups = new Map<number, number[]>();
	labels.forEach((label, i) => {
		const group = groups.get(label);
		if (group) group.push(i);
		else groups.set(label, [i]);
	});
	return { tree, chords, components: [...groups.values()] };
}
/** Roots every forest component at its smallest roof index. The traversal order puts
 * each parent before its children, independently of the input edge order. */
export function rootForest(count: number, tree: RoofLink[]) {
	const neighbors = Array.from({ length: count }, (): RoofLink[] => []);
	for (const edge of tree) {
		neighbors[edge.a].push(edge);
		neighbors[edge.b].push(edge);
	}
	const parent = new Int32Array(count).fill(-1),
		order: number[] = [],
		incoming: (RoofLink | undefined)[] = [];
	for (let root = 0; root < count; root++) {
		if (parent[root] !== -1) continue;
		parent[root] = root;
		const queue = [root];
		for (const i of queue) {
			order.push(i);
			for (const edge of neighbors[i]) {
				const j = edge.a === i ? edge.b : edge.a;
				if (parent[j] !== -1) continue;
				parent[j] = i;
				incoming[j] = edge;
				queue.push(j);
			}
		}
	}
	return { parent, incoming, order };
}
// A non-tree link plus the unique tree path between its endpoints is a fundamental cycle.
function pathEdges(a: number, b: number, forest: ReturnType<typeof rootForest>) {
	const ancestors = new Set([a]);
	for (let i = a; forest.parent[i] !== i; i = forest.parent[i]) ancestors.add(forest.parent[i]);
	const path: RoofLink[] = [];
	let common = b;
	while (!ancestors.has(common)) {
		path.push(parentLink(forest, common));
		common = forest.parent[common];
	}
	for (let i = a; i !== common; i = forest.parent[i]) path.push(parentLink(forest, i));
	return path;
}
function parentLink(forest: ReturnType<typeof rootForest>, i: number) {
	const edge = forest.incoming[i];
	if (!edge) throw new Error('Missing parent link on tree path');
	return edge;
}
/** Mandatory links are tree edges on no fundamental cycle. With at most two chords,
 * also retain the first two distinct single-edge exchanges in deterministic path order. */
export function treeExchanges(count: number, tree: RoofLink[], chords: RoofLink[]) {
	const forest = rootForest(count, tree),
		mandatory = new Set(tree),
		alternatives: RoofLink[][] = [];
	for (const chord of chords)
		for (const edge of pathEdges(chord.a, chord.b, forest)) {
			mandatory.delete(edge);
			if (chords.length <= 2 && alternatives.length < 2)
				alternatives.push([...tree.filter((e) => e !== edge), chord]);
		}
	return { mandatory: [...mandatory], alternatives };
}
