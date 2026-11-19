import { expect, spyOn, test } from 'bun:test';
import { probeWallConnections } from './carrier-diagonals';
import * as finalValidator from './carrier-probe';
import { singularCarrier, tenRoofStroke } from './fixtures/carrier-budget.fixture.test';

test('bounded repair of singular five- and six-group carriers', () => {
	for (const groups of [5, 6]) {
		const { grid, cells, parts } = singularCarrier(groups);
		expect(parts.length).toBe(groups * 17 + 2);
		const move = () => probeWallConnections(grid, parts, cells);
		const probe = spyOn(finalValidator, 'carrierProbe');
		try {
			expect(move()).toMatchObject({ failure: { reason: 'wall-layout-unresolved' } });
			expect(probe).toHaveBeenCalledTimes(2);
		} finally {
			probe.mockRestore();
		}
	}
});

test('a ten-roof pointer stroke installs a carrier', () => {
	const { stroke } = tenRoofStroke();
	expect(stroke.failure).toBeUndefined();
	expect(stroke.draft.state.parts.size).toBeGreaterThan(0);
});
