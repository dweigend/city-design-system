import type { FrameInstallation } from './frame-state';
import type { Vec3 } from '../parametrik/types';

// Section endpoints are in metres. A micrometre address resolves projection roundoff.
const joint = (p: Vec3) => p.map((v) => Math.round(v * 1e6)).join('/');

/** Counts installed crown spans between forks and ends; a closed degree-two cycle is one run. */
export function physicalRuns(
	main: ReadonlySet<string>,
	parts: ReadonlyMap<string, FrameInstallation> | undefined
) {
	const ends = new Map<string, string[]>(),
		node = new Map<string, string[]>(),
		lengths = new Map<string, number>();
	for (const id of main) {
		const result = parts?.get(id)?.result;
		const chord = result?.status === 'sized' && result.rods.find((r) => r.id === '2');
		if (!chord) continue;
		const vertices = [joint(chord.a), joint(chord.b)];
		ends.set(id, vertices);
		for (const v of vertices) {
			const ids = node.get(v) ?? [];
			ids.push(id);
			node.set(v, ids);
		}
	}
	function trace(first: string, start: string) {
		const chain = new Set<string>();
		let id = first,
			v = start;
		while (!chain.has(id) && !lengths.has(id)) {
			const pair = ends.get(id);
			if (!pair) break;
			chain.add(id);
			v = v === pair[0] ? pair[1] : pair[0];
			const exits = node.get(v);
			if (exits?.length !== 2) break;
			id = exits[0] === id ? exits[1] : exits[0];
		}
		for (const key of chain) lengths.set(key, chain.size);
	}
	for (const [v, edges] of node) if (edges.length !== 2) for (const id of edges) trace(id, v);
	for (const [id, [v]] of ends) if (!lengths.has(id)) trace(id, v);
	return {
		lengths,
		longestRun:
			ends.size === main.size ? [...lengths.values()].reduce((a, b) => Math.max(a, b), 0) : null
	};
}
