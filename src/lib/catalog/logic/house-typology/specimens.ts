import { squareGrid } from '../quad-grid';
import { planHouse } from '../composed-house';
import { planEnsemble, type Typology } from './index';
/** Builds a forced typology against a shared rectangular painted carrier. */
export function specimen(n: number, typology: Typology, height = 6, seed = 7) {
	const cells = squareGrid(n === 1 ? 1 : 2, n === 4 ? 2 : 1, 10).cells;
	const uses = ['water', 'living', 'living', 'food', 'material', 'energy'] as const;
	const site = {
		cells,
		seed,
		stacks: new Map(
			cells.map((c) => [c.id, Array.from({ length: height }, (_, i) => uses[i % uses.length])])
		)
	};
	const context = planEnsemble([site]),
		houses = new Map(context.houses);
	const [id, decision] = [...houses][0];
	houses.set(id, { ...decision, typology });
	return planHouse({ ...site, context: { ...context, houses } });
}
