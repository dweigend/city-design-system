import { expect, test } from 'bun:test';
import { squareGrid } from '../../src/lib/catalog/logic/quad-grid';
import { planEnsemble } from '../../src/lib/catalog/logic/house-typology';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';

for (const lower of [1, 2, 5]) {
	test(
		'the exposed tower wall resumes above the common base with a ' + lower + '-storey neighbour',
		() => {
			const sites = squareGrid(2, 1, 10).cells.map((c, i) => ({
				cells: [c],
				stacks: new Map([[c.id, Array<'water'>(i ? lower : 7).fill('water')]]),
				// Survey a full-height wall. Default ensemble screens stop at the podium.
				envelope: { system: 'pleated-sheet' as const },
				seed: 7
			}));
			const context = planEnsemble(sites);
			const [tower, other] = sites.map((site) => planHouse({ ...site, context }));
			const shell = tower.composition.exterior;
			if (!shell) throw Error('Missing tower exterior');
			const index = shell.seams.findIndex((s) => s.length === 1 && s[0].hidden);
			expect(index).toBeGreaterThanOrEqual(0);
			const wall = sectionParts(tower).find(
				(p) => p.source.objectId === 'full-height-shell' && p.id.endsWith('/' + index)
			);
			if (wall?.kind !== 'mesh') throw Error('Missing upper wall above the party wall');
			const z = wall.points.map((p) => p[2]);
			const expected = lower <= 2 ? other.top : tower.composition.levels[2].position[2];
			expect(Math.min(...z)).toBeCloseTo(expected, 7);
			expect(Math.max(...z)).toBeCloseTo(tower.top, 7);
		}
	);
}
