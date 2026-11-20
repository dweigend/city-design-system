import { expect, test } from 'bun:test';
import { shellSystems } from '../../src/lib/catalog/data/house-shells';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { polygonHouseSite } from '../../src/lib/catalog/logic/house-typology';
import { checkExteriorEntrance } from './exterior-entrance';

for (const system of shellSystems)
	test('an exterior approach crosses the square ' + system, () => {
		const site = polygonHouseSite(
			'square',
			[
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10]
			],
			['living', 'food', 'water'],
			5,
			{ system }
		);
		const house = planHouse(site);
		const parts = sectionParts(house);
		expect(parts.some((p) => p.source.objectId === 'full-height-shell')).toBe(true);
		checkExteriorEntrance(house, parts);
	});

test('the lantern wall crosses the approach if its planned opening is suppressed', () => {
	const site = polygonHouseSite(
		'square',
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		],
		['living', 'food', 'water'],
		5,
		{ system: 'prismatic-lantern' }
	);
	const house = planHouse(site);
	const shell = house.composition.exterior;
	if (!shell) throw Error('Expected lantern exterior');
	const closed = {
		...house,
		composition: { ...house.composition, exterior: { ...shell, openings: [] } }
	};
	expect(() => checkExteriorEntrance(house, sectionParts(closed))).toThrow(
		'Blocked exterior entrance'
	);
});
