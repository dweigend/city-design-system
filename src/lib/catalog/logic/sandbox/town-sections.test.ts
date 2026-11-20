import { projectBuildingSurface } from '../../scene/building-surface';
import { expect, test } from 'bun:test';
import { ACCENT_TOKEN, GROUND_TOKEN } from '../../data/house-body';
import { accentBody, ensembleAnchor, sectionParts } from '../composed-house';
import { openingScene } from './index';
import { townSections } from './composed-projection';

test('every occupied court in the seed-seven opening has its own houses and one coloured upper body', () => {
	const world = openingScene(7).world;
	const { sections } = townSections(world);
	const colours = new Set<string>(Object.values(ACCENT_TOKEN));
	const courts = world.state.city?.centres.flatMap((c) => c.ensembles) ?? [];
	expect(courts.length).toBeGreaterThan(0);
	for (const court of courts) {
		const occupied = court.lots.filter(
			(id) => world.state.storyParts.get(id)?.[0].style === 'composed'
		);
		const houses = sections.filter((h) => h.start === 0 && occupied.includes(h.id));
		expect(houses.map((h) => h.id).sort()).toEqual(occupied.sort());
		if (occupied.length < 2) continue;
		expect(houses.every((h) => h.composition.ensembleSize === occupied.length)).toBe(true);
		const anchors = houses.filter(ensembleAnchor);
		expect(anchors.map((h) => h.id)).toEqual([court.lots[0]]);
		const anchor = anchors[0],
			target = accentBody(anchor);
		expect(anchor.composition.levels.at(-1)?.bodies).toContain(target);
		const parts = sectionParts(anchor).filter((p) => p.id.startsWith(target.id + '/'));
		const walls = parts.filter((p) => p.buildingSurface?.slot === 'shell');
		const screens = parts.filter((p) => p.buildingSurface?.slot === 'screen');
		for (const screen of screens)
			expect(projectBuildingSurface(screen).token).toBe(GROUND_TOKEN[anchor.composition.shellUse]);
		expect(walls.length).toBeGreaterThan(0);
		expect(walls.every((p) => colours.has(projectBuildingSurface(p).token))).toBe(true);
	}
}, 60000);
