import { rootForest, spanForest, treeExchanges } from './roof-forest';
import type { RoofLink } from './roof-links';

function supports(edge: RoofLink, parent: number, p: number, c: number) {
	return edge.pairs[parent === edge.a ? p * edge.columns + c : c * edge.columns + p] === 1;
}
// reachable[i][b] means that bay b supports every subtree rooted below roof i.
function treeChoices(sizes: number[], tree: RoofLink[]) {
	const { parent, incoming, order } = rootForest(sizes.length, tree);
	const reachable = sizes.map((n) => new Uint8Array(n).fill(1));
	const witness: Int32Array[] = [];
	for (let j = order.length - 1; j >= 0; j--) {
		const child = order[j],
			edge = incoming[child];
		if (!edge) continue;
		const i = parent[child],
			choices = new Int32Array(sizes[i]).fill(-1);
		witness[child] = choices;
		for (let p = 0; p < sizes[i]; p++) {
			if (!reachable[i][p]) continue;
			choices[p] = reachable[child].findIndex((ok, c) => ok === 1 && supports(edge, i, p, c));
			if (choices[p] === -1) reachable[i][p] = 0;
		}
		if (!reachable[i].includes(1)) return;
	}
	const selected: number[] = [];
	for (const i of order)
		selected[i] = parent[i] === i ? reachable[i].indexOf(1) : witness[i][selected[parent[i]]];
	return selected;
}

type Selection =
	| { status: 'connected'; choices: number[] }
	| { status: 'span-disconnected'; components: number[][] }
	| { status: 'incompatible-bridge-bearings' }
	| { status: 'tree-layout-unresolved' | 'incompatible-cycle-bearings'; treesTried: number };

/** Selects one bay per roof from the compatibility graph. A bridge conflict proves
 * disconnection for every selection. A failed cyclic policy reports its own status. */
export function selectConnectedLayout(sizes: number[], edges: RoofLink[]): Selection {
	const { components, tree, chords } = spanForest(sizes.length, edges);
	if (components.length > 1) return { status: 'span-disconnected', components };
	const first = treeChoices(sizes, tree);
	if (first) return { status: 'connected', choices: first };
	if (!chords.length) return { status: 'incompatible-bridge-bearings' };
	const { mandatory, alternatives, exhaustive } = treeExchanges(sizes.length, tree, chords);
	if (!treeChoices(sizes, mandatory)) return { status: 'incompatible-bridge-bearings' };
	let treesTried = 1;
	for (const other of alternatives) {
		treesTried++;
		const choices = treeChoices(sizes, other);
		if (choices) return { status: 'connected', choices };
	}
	return {
		status: exhaustive ? 'incompatible-cycle-bearings' : 'tree-layout-unresolved',
		treesTried
	};
}
