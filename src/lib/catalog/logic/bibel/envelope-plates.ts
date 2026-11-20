import { planHouse, sectionParts } from '../composed-house';
import { polygonHouseSite, type HouseEnvelope } from '../house-typology';
import type { Point2 } from '../parametrik/vocab';

const plans: Record<string, Point2[]> = {
	triangle: [
		[0, 0],
		[18, 0],
		[9, 17]
	],
	pentagon: [
		[0, 0],
		[12, -2],
		[20, 7],
		[14, 18],
		[1, 15]
	],
	cove: [
		[0, 0],
		[8, -2],
		[17, 0],
		[20, 6],
		[15, 8],
		[17, 15],
		[10, 18],
		[1, 14],
		[-2, 6]
	]
};
type Study = [
	string,
	keyof typeof plans,
	HouseEnvelope['section'],
	HouseEnvelope['outline'],
	HouseEnvelope['skin'],
	HouseEnvelope['finish']
];
const studies: Study[] = [
	['Woven vessel', 'cove', 'vessel', 'oval', 'woven', 'holz-natur'],
	['Seamed cocoon', 'pentagon', 'lantern-neck', 'oval', 'cushioned', 'membran-gewebe'],
	['Terraced landscape', 'triangle', 'terrace-fan', 'faceted', 'plain', 'metall-gebuerstet'],
	['Crossed monoliths', 'pentagon', 'cross-stack', 'orthogonal', 'plain', 'beton-schalung'],
	['Fluted lantern', 'cove', 'lightwell', 'fluted', 'cushioned', 'glas-matt'],
	['Framed street house', 'pentagon', 'cross-stack', 'orthogonal', 'framed', 'metall-lackiert'],
	['Timber gable', 'triangle', 'gable', 'orthogonal', 'woven', 'holz-natur'],
	['Pillow envelope', 'cove', 'vessel', 'faceted', 'cushioned', 'membran-opal']
];

/** Published combinations use the same carrier, seeded levels, finishes and screen geometry as town lots. */
export function envelopePlates() {
	return studies.map(([title, plan, section, outline, skin, finish], i) => {
		const seed = 31 + i;
		const site = polygonHouseSite('study', plans[plan], Array(7).fill('living'), seed, {
			section,
			outline,
			skin,
			finish
		});
		return {
			id: 'envelope-' + i,
			title,
			text: [plan, section, outline, skin, finish].join(' · '),
			primitives: sectionParts(planHouse(site))
		};
	});
}
