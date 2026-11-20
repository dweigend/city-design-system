import { expect, test } from 'bun:test';
import { polygonHouseSite } from '../../src/lib/catalog/logic/house-typology';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { polygonCases } from './polygon-cases';

for (const shape of ['triangle', 'pentagon', 'amorphous']) {
	const { ring } = [...polygonCases(shape)][0];
	for (const system of ['quarry-portals', 'lapped-sails', 'prismatic-lantern'] as const) {
		test(shape + ' carries the occupied foot and ' + system + ' to its boundary', () => {
			const site = polygonHouseSite(shape, ring, Array(6).fill('living'), 91, { system });
			const house = planHouse(site);
			const shell = house.composition.exterior;
			if (!shell) throw Error('Missing exterior');
			expect(shell.stations[0].ring).toEqual(shell.ring);
			const foot = house.composition.levels[0].bodies[0].band?.footprint;
			expect(foot?.polygon).toEqual(shell.ring);
			for (const part of sectionParts(house).filter(
				(p) => p.source.objectId === 'full-height-shell'
			)) {
				if (part.kind !== 'mesh') throw Error('Missing exterior mesh');
				const atGrade = part.points.filter((p) => Math.abs(p[2] - shell.bottom) < 1e-8);
				expect(atGrade.length).toBeGreaterThan(1);
				for (const [x, y] of atGrade)
					expect(
						shell.ring.some(([a, b], i) => {
							const [c, d] = shell.ring[(i + 1) % shell.ring.length];
							const length = Math.hypot(c - a, d - b);
							return Math.abs(Math.hypot(x - a, y - b) + Math.hypot(x - c, y - d) - length) < 1e-8;
						})
					).toBe(true);
			}
		});
	}
}
