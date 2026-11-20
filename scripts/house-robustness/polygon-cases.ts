import { polygonHouseSite, type HouseEnvelope } from '../../src/lib/catalog/logic/house-typology';
import { sections as principles } from '../../src/lib/catalog/logic/house-typology/section-insets';
import type { Point2 } from '../../src/lib/catalog/logic/parametrik/vocab';
const forms: Record<string, Point2[]> = {
	triangle: [
		[0, 0],
		[26, 2],
		[8, 22]
	],
	pentagon: [
		[0, 0],
		[15, 0],
		[23, 12],
		[14, 23],
		[-2, 16]
	],
	amorphous: [
		[0, 1],
		[8, -2],
		[17, 0],
		[24, 5],
		[27, 13],
		[21, 17],
		[13, 14],
		[11, 21],
		[5, 23],
		[-2, 17],
		[-4, 9]
	]
};
const sections: HouseEnvelope['section'][] = [
	'terrace-fan',
	'lantern-neck',
	'cross-stack',
	'lightwell',
	'gable',
	'vessel'
];
/** Enumerates one boundary with each section and outline. */
export function* polygonCases(name: string, allPrinciples = false) {
	const ring = forms[name];
	const outlines: HouseEnvelope['outline'][] = ['oval', 'orthogonal', 'faceted', 'fluted'];
	for (const [i, section] of (allPrinciples ? principles : sections).entries())
		for (const [j, outline] of outlines.entries()) {
			if (allPrinciples && j !== i % outlines.length) continue;
			const seed = (allPrinciples ? 401 : 209) + i * 4 + j;
			const site = () =>
				polygonHouseSite(
					name,
					ring,
					Array((allPrinciples ? 6 : 3) + ((i + j) % 6)).fill('living'),
					seed,
					{
						section,
						outline
					}
				);
			yield { id: [name, section, outline].join('/'), ring, seed, site };
		}
}
