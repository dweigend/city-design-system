import type { Section } from './types';
import { sectionSurfaces, type SectionSurfaces } from './surfaces';
import { planPoints } from './part-plan';
import { partsIntersect } from '../house-typology';
import { bodyParts } from './provider';
import { houseStructure } from './structure';
import { bounds } from '../ansicht/geometrie';
import type { StockPart } from './house-object';

/** Projects the building members against which a stair is fitted and budgeted. */
export function stairHouse(s: Section, surfaces: SectionSurfaces = sectionSurfaces(s)) {
	return [...houseStructure(s, surfaces), ...s.slots.flatMap((b) => bodyParts(b, surfaces))];
}
function obstacles(house: StockPart[]) {
	const stock = house.filter(
		(p) =>
			p.source.objectId !== 'primitive-slab' || !('roofCell' in p) || p.id.endsWith('/socle/body/0')
	);
	return stock.map((part) => {
		const ext = bounds(part);
		if ((part.kind === 'box' || part.kind === 'wedge') && part.rotation) {
			const pts = planPoints(part);
			for (const k of [0, 1] as const) {
				ext.min[k] = Math.min(...pts.map((p) => p[k]));
				ext.max[k] = Math.max(...pts.map((p) => p[k]));
			}
		}
		return { part, ext };
	});
}
/** Tests a mounted member against the occupied house at the assembly tolerance. */
export function stairClearance(house: StockPart[]) {
	const stock = obstacles(house);
	const levels = new Map<string, typeof stock>();
	return (p: StockPart) => {
		const box = bounds(p),
			z = box.min[2];
		const key = z + '/' + box.max[2];
		let row = levels.get(key);
		if (!row) {
			row = stock.filter(({ ext }) => ext.min[2] < box.max[2] - 0.02 && ext.max[2] > z + 0.02);
			levels.set(key, row);
		}
		return row.every(
			({ part, ext }) =>
				ext.min.some((v, k) => v >= box.max[k] - 0.02 || ext.max[k] <= box.min[k] + 0.02) ||
				!partsIntersect(p, part)
		);
	};
}
