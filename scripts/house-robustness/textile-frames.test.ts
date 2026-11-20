import { expect, test } from 'bun:test';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import { polygonHouseSite } from '../../src/lib/catalog/logic/house-typology';

const footprints: Record<string, [number, number][]> = {
	triangle: [
		[0, 0],
		[18, 0],
		[5, 14]
	],
	pentagon: [
		[0, 0],
		[15, 0],
		[23, 12],
		[14, 23],
		[-2, 16]
	],
	irregular: [
		[0, 0],
		[16, 1],
		[20, 7],
		[17, 19],
		[8, 22],
		[-3, 10]
	],
	concave: [
		[0, 0],
		[18, 0],
		[18, 6],
		[7, 6],
		[7, 18],
		[0, 18]
	]
};
for (const [shape, ring] of Object.entries(footprints)) {
	for (const frame of ['mast', 'fan-truss', 'scissor', 'ring', 'outrigger'] as const) {
		test(shape + ' supports the ' + frame + ' with surveyed grips', () => {
			const s = planHouse(
				polygonHouseSite('frame', ring, ['water', 'living', 'food'], 91, {
					system: 'tensile-sail',
					frame
				})
			);
			const parts = sectionParts(s);
			checkParcel(s, parts);
			const rods = parts.filter((p) => p.kind === 'pipe' && p.id.includes('/frame/'));
			expect(rods.length).toBeGreaterThan(2);
			const skins = parts.filter(
				(p) => p.kind === 'mesh' && p.source.objectId === 'full-height-shell'
			);
			const vertices = new Set(
				skins.flatMap((m) =>
					m.kind === 'mesh' ? m.points.map((p) => p.map((v) => v.toFixed(5)).join('/')) : []
				)
			);
			const tips = rods.flatMap((r) =>
				r.kind === 'pipe' ? [r.points[0], r.points[r.points.length - 1]] : []
			);
			expect(
				tips.filter((p) => vertices.has(p.map((v) => v.toFixed(5)).join('/'))).length
			).toBeGreaterThan(rods.length / 2);
		});
	}
}
