export type SearchSettings = Readonly<{
	strategy: 'greedy' | 'exact' | 'beam';
	lookahead: number;
	width: number;
	budget: number;
}>;
export type Contributions = Readonly<Record<string, number>>;
type Step<S, A> = { state: S; action: A; tick: number; contributions: Contributions };
type Path<S, A> = { state: S; steps: Step<S, A>[]; score: number };
export type Simulator<S, A> = {
	/** Ordered local choices; order resolves exact score ties. */
	choices: (state: S, tick: number) => readonly A[];
	/** Returns a detached successor or undefined for a veto. */
	step: (
		state: S,
		action: A,
		tick: number
	) => { state: S; contributions: Contributions } | undefined;
};

/** Explores dated sequences breadth first. Each attempted transition consumes one expansion,
 * including vetoes. On exhaustion the last fully evaluated depth wins; at depth zero it waits.
 */
export function searchSequences<S, A>(
	initial: S,
	tick: number,
	domain: Simulator<S, A>,
	settings: SearchSettings
) {
	const { strategy, width, budget, lookahead } = settings;
	validateSettings(settings);
	let frontier: Path<S, A>[] = [{ state: initial, steps: [], score: 0 }],
		expansions = 0,
		pruned = 0,
		exhausted = false;

	function expand(paths: Path<S, A>[], next: Path<S, A>[], date: number) {
		for (const path of paths) {
			for (const action of domain.choices(path.state, date)) {
				if (expansions === budget) {
					return false;
				}
				expansions++;
				const result = domain.step(path.state, action, date);
				if (!result) continue;
				const value = Object.values(result.contributions).reduce((a, b) => a + b, 0);
				if (!Number.isFinite(value)) throw new RangeError('Nonfinite planning utility');
				next.push({
					state: result.state,
					steps: [...path.steps, { ...result, action, tick: date }],
					score: path.score + value
				});
			}
		}
		return true;
	}
	const depth = strategy === 'greedy' ? 1 : lookahead + 1;
	for (let level = 0; level < depth; level++) {
		const next: Path<S, A>[] = [];
		exhausted = !expand(frontier, next, tick + level);
		if (exhausted || !next.length) break;
		next.sort((a, b) => b.score - a.score);
		const keep = strategy === 'exact' ? next.length : strategy === 'greedy' ? 1 : width;
		pruned += Math.max(0, next.length - keep);
		frontier = next.slice(0, keep);
	}
	const best = frontier[0];
	return {
		...best,
		diagnostics: {
			...settings,
			expansions,
			pruned,
			exhausted,
			completedDepth: best.steps.length,
			complete: best.steps.length === depth
		}
	};
}

/** Runs immutable checkpoints through the host's commit operation. Fork by reusing any checkpoint. */
export function runTicks<S, R>(
	checkpoint: S,
	count: number,
	advance: (state: S, index: number) => { state: S; result: R }
) {
	if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid tick count');
	const series: R[] = [],
		checkpoints: S[] = [checkpoint];
	for (let i = 0; i < count; i++) {
		const { state, result } = advance(checkpoints[i], i);
		series.push(result);
		checkpoints.push(state);
	}
	return { series, checkpoints };
}

function validateSettings({ width, budget, lookahead }: SearchSettings) {
	if (
		![width, budget, lookahead].every(Number.isSafeInteger) ||
		width < 1 ||
		width > 64 ||
		budget < 0 ||
		budget > 100000 ||
		lookahead < 0 ||
		lookahead > 8
	)
		throw new RangeError('Invalid search settings');
}
