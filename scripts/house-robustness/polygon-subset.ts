import { checkExteriorEntrance } from './exterior-entrance';
import { expect, test } from 'bun:test';
import { polygonCases } from './polygon-cases';
import { planHouse, sectionParts, circulation } from '../../src/lib/catalog/logic/composed-house';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import { accessShare } from '../../src/lib/catalog/logic/composed-house/access-budget';
import { massGraph } from './masses';
import { ringArea } from '../../src/lib/catalog/logic/quad-grid';
/** Exercises every section/outline pair on one surveyed exterior ring. */
export function polygonSubset(name: string, allPrinciples = false) {
	for (const item of polygonCases(name, allPrinciples))
		test(item.id, () => {
			const { ring, seed } = item;
			const site = item.site();
			const house = planHouse(site),
				parts = sectionParts(house);
			expect(
				site.cells.reduce((area, c) => area + ringArea(c.corners.map(([x, y]) => [x, y])), 0)
			).toBeCloseTo(ringArea(ring), 8);
			auditPolygon(item.id, seed, house, parts);
		});
}

/** Checks the occupied mass, parcel, access and storey heights of one projected polygon house. */
export function auditPolygon(
	name: string,
	seed: number,
	house: ReturnType<typeof planHouse>,
	parts: ReturnType<typeof sectionParts>
) {
	const graph = massGraph([house]),
		share = accessShare(parts.filter((p) => p.structuralRole !== 'occupant'));
	checkParcel(house, parts);
	checkExteriorEntrance(house, parts);
	expect(graph.collisions).toBe(0);
	expect(graph.components).toBe(1);
	expect(share).toBeLessThanOrEqual(0.1);
	const route = circulation(house);
	for (const l of house.composition.levels)
		expect(route.docks.some((d) => d.door.every((v, k) => v === l.landing[k]))).toBe(true);
	const heights = house.decks.slice(1).map((l, k) => l.position[2] - house.decks[k].position[2]);
	expect(new Set(heights.map((h) => h.toFixed(2))).size).toBeGreaterThan(1);
	console.log(
		'POLYGON ' +
			JSON.stringify({
				name,
				seed,
				share,
				components: graph.components,
				collisions: graph.collisions,
				spanning: graph.spanning,
				minHeight: Math.min(...heights),
				maxHeight: Math.max(...heights)
			})
	);
}
