// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
import { runTicks, searchSequences, type Simulator, type SearchSettings } from './index';

// One battery slot. Charging takes today's slot and can serve the following peak.
type Action = 'sell' | 'charge' | 'dispatch' | 'wait';
const battery: Simulator<number, Action> = {
	choices: () => ['sell', 'charge', 'dispatch', 'wait'],
	step: (charge, action, tick) => {
		if ((action === 'charge' && charge) || (action === 'dispatch' && !charge)) return;
		const state = action === 'charge' ? 1 : action === 'dispatch' ? 0 : charge;
		const revenue = action === 'sell' ? 2 : action === 'dispatch' && tick === 2 ? 12 : 0;
		return { state, contributions: { revenue } };
	}
};
const settings: SearchSettings = { lookahead: 2, width: 1, budget: 200, strategy: 'exact' };
test('a finite store trades immediate revenue for the peak and exposes beam pruning loss', () => {
	const oracle = searchSequences(0, 0, battery, settings);
	const beam = searchSequences(0, 0, battery, { ...settings, strategy: 'beam' });
	expect(oracle.score).toBe(14);
	expect(beam.score).toBe(6);
	expect(beam.diagnostics.pruned).toBeGreaterThan(0);
	const fork = runTicks(0, 3, (state, i) => {
		const plan = searchSequences(state, i, battery, { ...settings, lookahead: 2 - i });
		return { state: plan.steps[0].state, result: plan.steps[0].action };
	});
	expect(fork.series).toContain('charge');
	expect(fork.checkpoints.at(-1)).toBe(0);
	console.info(
		'STORAGE ' +
			JSON.stringify({
				oracle: oracle.score,
				beam: beam.score,
				gap: oracle.score - beam.score,
				oracleWork: oracle.diagnostics.expansions,
				beamWork: beam.diagnostics.expansions
			})
	);
});
test('exhaustion retains the best completed depth and no legal transition leaves the initial checkpoint', () => {
	const short = searchSequences(0, 0, battery, { ...settings, budget: 5 });
	expect(short.diagnostics).toMatchObject({ exhausted: true, completedDepth: 1, expansions: 5 });
	expect(searchSequences(0, 0, { ...battery, choices: () => [] }, settings).steps).toEqual([]);
});
