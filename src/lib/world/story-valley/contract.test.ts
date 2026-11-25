import { expect, test } from 'bun:test';
import { createStoryValley, storyPrecedent, storyYears } from './index';

const story = createStoryValley();
const { snapshots } = story;

test('opens on a first settlement and grows through two visible milestones to 2030', () => {
	expect(snapshots.map(({ year }) => year)).toEqual([1955, 1985, 2012, 2030]);
	expect(snapshots[0].buildings.length).toBeGreaterThan(0);
	for (const [index, snapshot] of snapshots.slice(1, -1).entries()) {
		expect(snapshot.buildings.length).toBeGreaterThan(snapshots[index].buildings.length);
		expect(snapshot.buildings.some(({ builtYear }) => builtYear === snapshot.year)).toBe(true);
	}
	expect(snapshots[0].crossings).toHaveLength(0);
	const [crossing] = snapshots[1].crossings;
	expect(crossing.builtYear).toBe(1985);
	expect(crossing.headIds).toHaveLength(2);
	expect(crossing.headIds[0]).not.toBe(crossing.headIds[1]);
	expect(crossing.object.parts.length).toBeGreaterThan(0);
	expect(snapshots[3].crossings).toEqual([crossing]);
});

test('retains building and part identities, geometry and dates at every later event', () => {
	for (const [index, { buildings }] of snapshots.entries()) {
		for (const later of snapshots.slice(index + 1)) {
			for (const building of buildings) {
				const { parts, ...identity } = building;
				const existing = later.buildings.find(({ id }) => id === building.id);
				expect(existing).toMatchObject(identity);
				for (const record of parts) {
					const part = existing?.parts.find(({ part }) => part.id === record.part.id);
					expect(part).toEqual({ ...record, phase: 'retained' });
				}
			}
		}
	}
});

test('dates every visible part and distinguishes additions from retained stock', () => {
	for (const { year, buildings } of snapshots) {
		const parts = buildings.flatMap(({ parts }) => parts);
		expect(new Set(parts.map(({ part }) => part.id)).size).toBe(parts.length);
		expect(parts.some(({ phase }) => phase === 'addition')).toBe(true);
		for (const { builtYear, datumIndex, part, phase } of parts) {
			expect(builtYear).toBeLessThanOrEqual(year);
			expect(phase).toBe(builtYear === year ? 'addition' : 'retained');
			expect(part.id.endsWith('/' + datumIndex)).toBe(true);
		}
	}
});

test('the cited precedent resolves to a retained lower storey and an added storey above it', () => {
	expect(storyPrecedent).toMatchObject({
		project: 'Transformation of Tour Bois-le-Prêtre',
		architects: 'Lacaton & Vassal with Frédéric Druot',
		year: 2011,
		prizeYear: 2021
	});
	expect(new URL(storyPrecedent.prizeUrl).hostname).toBe('www.pritzkerprize.com');
	const { buildingId, retainedPartId, additionPartId } = story.adoption;
	const hall = snapshots[3].buildings.find(({ id }) => id === buildingId);
	const original = hall?.parts.find(({ part }) => part.id === retainedPartId);
	const extension = hall?.parts.find(({ part }) => part.id === additionPartId);
	expect(original).toMatchObject({ phase: 'retained', builtYear: 1955 });
	expect(extension).toMatchObject({ phase: 'addition', builtYear: 2030 });
	expect(extension?.datumIndex).toBe((original?.datumIndex ?? NaN) + 1);
	expect(
		snapshots[2].buildings
			.find(({ id }) => id === buildingId)
			?.parts.some(({ part }) => part.id === additionPartId)
	).toBe(false);
});

test('repeats the fixed seed, window, adoption and dated world data exactly', () => {
	const repeated = createStoryValley();
	expect(repeated.seed).toBe(story.seed);
	expect(repeated.valley.course.xy).toEqual(story.valley.course.xy);
	expect(repeated.window).toEqual(story.window);
	expect(repeated.adoption).toEqual(story.adoption);
	expect(repeated.snapshots).toEqual(snapshots);
	expect(repeated.snapshots.map(({ year }) => year)).toEqual([...storyYears]);
});
