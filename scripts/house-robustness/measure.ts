import { checkExteriorEntrance } from './exterior-entrance';
import {
	planHouse,
	sectionParts,
	paintedSections,
	circulation,
	houseLinks
} from '../../src/lib/catalog/logic/composed-house';
import { massGraph } from './masses';

import { accessShare } from '../../src/lib/catalog/logic/composed-house/access-budget';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import type { cases } from './sites';

type Section = ReturnType<typeof planHouse>;
const eps = 1e-8;
function connected(section: Section) {
	const { levels } = section.composition;
	const { legs, docks } = circulation(section);
	const close = (a: number[], b: number[]) => a.every((v, k) => Math.abs(v - b[k]) < eps);
	return (
		legs.length > 0 &&
		legs.every((l, i) => i === 0 || close(legs[i - 1].to, l.from)) &&
		levels.every((l) =>
			docks.some(
				(d) =>
					close(d.door, l.landing) &&
					legs.some((leg) => close(d.station, leg.to) || close(d.station, leg.from))
			)
		)
	);
}
/** Audits real planner outputs in metres, using the existing structural roles and access budget. */
export function measure({ sites, seed, grid }: ReturnType<typeof cases>[number]) {
	const owners = new Map(sites.flatMap((s) => s.cells.map((c) => [c.id, s] as const)));
	const stacks = new Map(sites.flatMap((s) => [...s.stacks]));
	const houses = paintedSections(grid, stacks, seed, {
		joined: (a, b) => owners.get(a) === owners.get(b)
	});
	if (houses.length !== sites.length) throw Error('Painted footprints changed lot count');
	const isolated = planHouse(sites[0]);
	const isolatedGraph = massGraph([isolated]);
	const errors: string[] = [];
	let share = 0;
	for (const h of [...houses, isolated]) {
		const parts = sectionParts(h);
		try {
			checkParcel(h, parts);
			checkExteriorEntrance(h, parts);
		} catch (e) {
			errors.push(String(e).split('\n')[0]);
		}
		share = Math.max(share, accessShare(parts.filter((p) => p.structuralRole !== 'occupant')));
		if (!connected(h)) errors.push('disconnected route ' + h.id);
	}
	const links = houseLinks(grid, houses, seed);
	return {
		...massGraph(houses),
		isolated: isolatedGraph.components,
		isolatedCollisions: isolatedGraph.collisions,
		share,
		errors,
		bridges: links.length
	};
}
