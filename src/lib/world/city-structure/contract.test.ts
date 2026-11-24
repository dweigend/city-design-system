import { expect, test } from 'bun:test';
import { cityLatticesByPlan, createCityLattice, latticeVolumes } from '../../domain/city-volume';
import { gravityBalanceTolerance, runGravity } from '../../domain/structure';
import { cityStructureSettings, createCityStructure, structureTownExample } from './index';

const { columns, layout, quarter } = structureTownExample();
const { datumZ, variant } = layout;

test('uses a connected quarter of the default town', () => {
	expect(quarter.length).toBe(Math.ceil(columns.length / 4));
	expect(quarter.some(({ kind }) => kind === 'block')).toBe(true);
});

for (const model of cityLatticesByPlan[variant]) {
	test(`${model} preserves lattice IDs and carries the quarter load to the ground`, () => {
		const lattice = createCityLattice(quarter, datumZ, variant, model);
		const { graph, loads } = createCityStructure(lattice, datumZ);
		expect(graph.joints.map(({ id }) => id)).toEqual(lattice.nodes.map(({ id }) => id).sort());
		expect(graph.members.map(({ id }) => id)).toEqual(lattice.edges.map(({ id }) => id).sort());

		const ground = lattice.nodes.filter(({ id }) => /\/level\/0$|\/ground-center$/.test(id));
		expect(ground.length).toBeGreaterThan(0);
		expect(graph.joints.filter(({ support }) => support === 'pinned').map(({ id }) => id)).toEqual(
			ground.map(({ id }) => id).sort()
		);
		expect(graph.members.some(({ section }) => section === 'heavy')).toBe(true);
		expect(graph.members.some(({ section }) => section === 'light')).toBe(true);
		expect(graph.members.some(({ role }) => role === 'beam')).toBe(true);

		const result = runGravity(graph, loads);
		const volume = latticeVolumes(lattice).reduce((sum, value) => sum + value, 0);
		const weight = volume * cityStructureSettings.tributaryWeightKNM3.value;
		expect(Math.abs(result.appliedKN - weight)).toBeLessThan(weight * gravityBalanceTolerance);
		expect(result.status).toBe('routed');
		expect(result.unsupported).toEqual([]);
		expect(Math.abs(result.appliedKN - result.reactedKN)).toBeLessThan(
			result.appliedKN * gravityBalanceTolerance
		);
	});
}
