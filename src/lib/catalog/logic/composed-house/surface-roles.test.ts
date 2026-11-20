import { expect, test } from 'bun:test';
import { flowToken } from '../../data/focus';
import { ACCENT_TOKEN, GROUND_TOKEN } from '../../data/house-body';
import { projectBuildingSurface } from '../../scene/building-surface';
import { squareGrid } from '../quad-grid';
import { openingScene } from '../sandbox';
import { townSections } from '../sandbox/composed-projection';
import { accentBody, planHouse, sectionParts, houseSurfaces } from './index';

const colourKey = /^(?:colou?r|colou?rRole|token|topToken|finish|pigment|overprint|printBand)$/i;
const colourValue =
	/^(?:--|#[\da-f]{3,8}$|rgba?\(|hsla?\(|pink$|lavender$|black$|white$|red$|green$|blue$)/i;

function checkGeometry(value: unknown, path: string) {
	if (typeof value === 'string') {
		expect(colourValue.test(value), path).toBe(false);
	} else if (Array.isArray(value)) {
		for (const item of value) if (typeof item !== 'number') checkGeometry(item, path);
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			expect(colourKey.test(key), path + '.' + key).toBe(false);
			checkGeometry(item, path + '.' + key);
		}
	}
}

function checkHouse(house: ReturnType<typeof planHouse>) {
	checkGeometry(house.composition.exterior, house.id + '/exterior');
	const parts = sectionParts(house);
	const accent = accentBody(house).id + '/';
	expect(parts.some((p) => p.id.startsWith(accent))).toBe(true);
	let painted = false;
	for (const part of parts) {
		checkGeometry(part, part.id);
		const role = part.buildingSurface;
		if (!role) throw Error('Missing building surface on ' + part.id);
		expect(role.use).toBe(house.composition.shellUse);
		expect(role.ensemble).toBe(house.ensemble);
		const resolved = projectBuildingSurface(part);
		expect(resolved.finish, part.id).toBeDefined();
		expect(resolved.token, part.id).toBeDefined();
		expect(resolved.token, part.id).not.toBe(flowToken.people);
		if (role.accentUse) {
			expect(part.id.startsWith(accent)).toBe(true);
			expect(resolved.token).toBe(ACCENT_TOKEN[role.accentUse]);
			painted = true;
		} else if (['shell', 'base', 'deck', 'screen'].includes(role.slot)) {
			expect(resolved.token).toBe(GROUND_TOKEN[role.use]);
		}
	}
	expect(painted).toBe(true);
}

for (const seed of [7, 29])
	test(
		'Surface guard rejects path pink on every opening town house part, seed ' + seed,
		() => {
			const { sections } = townSections(openingScene(seed).world);
			expect(sections.length).toBeGreaterThan(0);
			for (const house of sections) checkHouse(house);
		},
		60000
	);

test('Surface guard covers pleated and textile shells and their caller overrides', () => {
	const cells = squareGrid(1, 1, 10).cells;
	for (const system of [
		'pleated-sheet',
		'inflated-cushion',
		'suspended-curtain',
		'tensile-sail'
	] as const) {
		const house = planHouse({
			cells,
			seed: 3,
			stacks: new Map([[cells[0].id, ['living', 'living', 'living', 'living']]]),
			envelope: { system, finish: 'metall-gebuerstet' }
		});
		checkHouse(house);
		const exterior = sectionParts(house).filter((p) => p.source.objectId === 'full-height-shell');
		expect(exterior.length).toBeGreaterThan(0);
		for (const part of exterior) {
			expect(part.buildingSurface?.slot).toBe('shell');
			expect(projectBuildingSurface(part).finish).not.toBe('metall-gebuerstet');
		}
		const override = { token: '--signal', finish: 'wood' } as const;
		const changed = sectionParts(house, { ...houseSurfaces, shell: override });
		for (const p of changed.filter((part) => part.source.objectId === 'full-height-shell'))
			expect(projectBuildingSurface(p)).toMatchObject(override);
	}
});
