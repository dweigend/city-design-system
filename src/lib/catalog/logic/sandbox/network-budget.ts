import { planNetwork, type NetworkInput } from '../walkway-network';

/** Retry an infeasible tree once with twice the footprint allowance (12% to 24%).
 * The planner retains its length limit, entrance checks and all physical clearances. */
export function budgetedNetwork(input: NetworkInput, seed: number) {
	for (const factor of [1, 2]) {
		try {
			return planNetwork({ ...input, ensembleArea: input.ensembleArea * factor }, seed);
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
		}
	}
}
