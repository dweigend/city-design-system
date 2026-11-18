import { crownLinks, type Bay } from './bearing-layout';

// A partial choice can only lose links as each remaining roof commits to one bay.
function canConnect(options: Bay[][], maxSpan: number) {
	const reached = new Set([0]);
	for (const i of reached) {
		for (const [j, candidates] of options.entries()) {
			if (reached.has(j)) continue;
			if (options[i].some((a) => candidates.some((b) => crownLinks(a, b, maxSpan).length > 0)))
				reached.add(j);
		}
	}
	return reached.size === options.length;
}
/** Yields connected assemblies in canonical preference order. A disconnected optimistic
 * graph prunes all completions of the current prefix before any structural solve. */
export function* connectedLayouts(options: Bay[][], maxSpan: number): Generator<Bay[]> {
	const remaining = [...options];
	function* visit(index: number): Generator<Bay[]> {
		if (!canConnect(remaining, maxSpan)) return;
		if (index === options.length) {
			yield remaining.map(([bay]) => bay);
			return;
		}
		for (const bay of options[index]) {
			remaining[index] = [bay];
			yield* visit(index + 1);
		}
		remaining[index] = options[index];
	}
	yield* visit(0);
}
