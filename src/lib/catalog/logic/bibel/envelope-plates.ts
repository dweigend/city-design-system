import { shellSystems } from '../../data/house-shells';
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
	['Pillow envelope', 'cove', 'vessel', 'faceted', 'cushioned', 'membran-opal'],
	['Orbital chambers', 'pentagon', 'orbital-nodes', 'oval', 'framed', 'metall-gebuerstet'],
	['Mushroom canopy', 'cove', 'canopy-cap', 'fluted', 'woven', 'holz-natur'],
	['Counterweight', 'triangle', 'counterweight', 'orthogonal', 'plain', 'beton-schalung'],
	['Spiral terraces', 'pentagon', 'spiral-terrace', 'oval', 'framed', 'keramik-glasiert'],
	['Buttressed spire', 'triangle', 'buttressed-spire', 'fluted', 'woven', 'metall-gebuerstet'],
	['Diagonal sail', 'cove', 'diagonal-sail', 'faceted', 'cushioned', 'metall-gebuerstet'],
	['Saddle section', 'pentagon', 'saddle', 'oval', 'woven', 'membran-gewebe'],
	['Folded fan', 'cove', 'folded-fan', 'faceted', 'plain', 'metall-lackiert'],
	['Table house', 'triangle', 'table-house', 'orthogonal', 'framed', 'beton-schalung'],
	['Inhabited outcrop', 'cove', 'outcrop', 'faceted', 'plain', 'beton-schalung'],
	['Ziggurat', 'pentagon', 'tiered-ziggurat', 'orthogonal', 'plain', 'keramik-glasiert'],
	['Waisted shell', 'triangle', 'waisted-shell', 'oval', 'woven', 'membran-gewebe'],
	['Corbelled bowl', 'cove', 'corbelled-bowl', 'fluted', 'cushioned', 'glas-matt'],
	['Longhouse', 'triangle', 'longhouse', 'orthogonal', 'woven', 'holz-natur']
];

/** Published combinations use the same carrier, seeded levels, finishes and screen geometry as town lots. */
export function envelopePlates() {
	return studies.map(([title, plan, section, outline, skin, finish], i) => {
		const seed = 31 + i;
		const system = shellSystems[[3, 0, 2, 4, 14, 7, 5, 1, 10, 6, 11, 9, 15, 12, 13, 8][i % 16]];
		const site = polygonHouseSite('study', plans[plan], Array(7).fill('living'), seed, {
			section,
			system,
			outline,
			skin,
			finish
		});
		return {
			id: 'envelope-' + i,
			title,
			text: [plan, section, system, outline, skin, finish].join(' · '),
			primitives: sectionParts(planHouse(site))
		};
	});
}
