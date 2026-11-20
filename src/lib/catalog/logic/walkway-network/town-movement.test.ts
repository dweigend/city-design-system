import { expect, test } from 'bun:test';
import { surveyTownWalk, townDeck } from './index';
import type { Vec3 } from '../parametrik/types';

test('an oblique public approach docks the full ribbon width at the court floor', () => {
	const court = {
		id: 'court',
		position: [0, 0, 2] as Vec3,
		area: 256,
		polygon: [
			[-8, -8],
			[8, -8],
			[8, 8],
			[-8, 8]
		] as [number, number][],
		aprons: []
	};
	const args = [
		[['court', 'lane']],
		(id: string): Vec3 => (id === 'court' ? court.position : [25, 13, 2]),
		[court],
		() => 0,
		7
	] satisfies Parameters<typeof townDeck>;
	const { graph } = surveyTownWalk(...args);
	const dock = graph.edges.find((e) => e.from === 'court');
	expect(dock?.kind).toBe('dock');
	expect(dock?.grade).toBe(0);
	const parts = townDeck(...args);
	expect(parts.filter((p) => p.id.startsWith('court/court/step/'))).toEqual([]);
	const ramp = parts.find(
		(p) => p.kind === 'mesh' && p.id.startsWith('town-walk/') && p.id.endsWith('/ramp')
	);
	if (ramp?.kind !== 'mesh') throw Error('Missing docked ribbon');
	const contact = [0, ramp.points.length - 4]
		.map((i) => ramp.points.slice(i + 2, i + 4))
		.find((edge) => edge.every((p) => Math.abs(p[0] - 8) < 1e-7));
	if (!contact) throw Error('Ribbon end does not meet the court edge');
	expect(contact.every((p) => Math.abs(p[2] - 2) < 1e-7)).toBe(true);
	expect(Math.abs(contact[0][1] - contact[1][1])).toBeCloseTo(1.8);
});
