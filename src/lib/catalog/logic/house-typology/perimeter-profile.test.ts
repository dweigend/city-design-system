import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { houseSurfaces, planHouse, sectionParts } from '../composed-house';
import { sections } from './section-insets';
import { houseEnvelope, type HouseEnvelope } from './envelope';

function build(request: Partial<HouseEnvelope>) {
	const cells = squareGrid(1, 1, 12).cells;
	return planHouse({
		cells,
		stacks: new Map(cells.map((c) => [c.id, Array<'living'>(7).fill('living')])),
		seed: 12,
		envelope: request
	});
}
function outlines(request: Partial<HouseEnvelope>) {
	return build(request)
		.composition.levels.slice(2)
		.map((l) => l.bodies[0].band?.footprint);
}
test('twenty section rules give different occupied elevations on the same lot', () => {
	expect(sections.length).toBeGreaterThanOrEqual(20);
	const profiles = sections.map((section) =>
		JSON.stringify(outlines({ section, outline: 'oval' }))
	);
	expect(new Set(profiles).size).toBe(sections.length);
});
test('the same section takes four plan contours independently of surface dressing', () => {
	const profiles: HouseEnvelope['outline'][] = ['faceted', 'oval', 'orthogonal', 'fluted'];
	expect(
		new Set(profiles.map((outline) => JSON.stringify(outlines({ section: 'gable', outline })))).size
	).toBe(profiles.length);
	expect(outlines({ finish: 'holz-natur', skin: 'woven' })).toEqual(
		outlines({ finish: 'membran-opal', skin: 'cushioned' })
	);
});
test('a partial override preserves all independently drawn envelope choices', () => {
	const prior = houseEnvelope('0/0', 47);
	expect(houseEnvelope('0/0', 47, { finish: 'glas-matt' })).toEqual({
		...prior,
		finish: 'glas-matt'
	});
});
test('the public projection constructs the selected screen and dresses the body with the requested finish', () => {
	for (const skin of ['plain', 'woven', 'framed', 'cushioned'] as const) {
		const s = build({ section: 'vessel', skin, finish: 'membran-gewebe' });
		const parts = sectionParts(s, {
			...houseSurfaces,
			shell: { token: '--cat-mobility', finish: 'membran-gewebe' }
		});
		expect(parts.filter((p) => p.id.endsWith('/screen') && p.kind === 'mesh').length > 0).toBe(
			skin !== 'plain'
		);
		expect(parts.some((p) => p.finish === 'membran-gewebe')).toBe(true);
	}
});
