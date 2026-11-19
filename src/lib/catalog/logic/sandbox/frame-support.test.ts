import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { STORY } from '../../data/grid';
import { insetRing, roofWalls } from '../house-brush';
import type { Vec3 } from '../parametrik/types';
import { buildingPlots } from './building-plots';
import type { FrameInstallation } from './frame-state';
import { applyEdit, frameSurvey, type World } from './index';
import { frameCarrier } from './fixtures/frame-carrier.fixture.test';

function onCrown(world: World, house: string, p: Vec3) {
	const plots = buildingPlots(world.grid),
		lot = plots.cellsById.get(house);
	assert(lot);
	const stack = world.state.stacks.get(house);
	if (!stack?.length || Math.abs(lot.pad + stack.length * STORY - p[2]) > 1e-6) return false;
	const wall = roofWalls(plots, world.state.stacks, lot, world.seed);
	const ring = insetRing(
		lot.corners.map(([x, y]) => [x, y]),
		wall.inset
	);
	return ring.some(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		return (
			wall.exposed[i] &&
			Math.abs(
				Math.hypot(p[0] - x, p[1] - y) + Math.hypot(p[0] - u, p[1] - v) - Math.hypot(x - u, y - v)
			) < 1e-6
		);
	});
}

type Rods = Extract<FrameInstallation['result'], { status: 'sized' }>['rods'];

function checkMembers(world: World, id: string, houses: readonly string[], rods: Rods) {
	const chord = rods.find((r) => r.id === '2');
	assert(chord);
	for (const rod of rods) {
		if (rod.id === '2') continue;
		expect(houses.some((h) => onCrown(world, h, rod.a))).toBe(true);
		expect([chord.a, chord.b]).toContainEqual(rod.b);
		const part = world.state.parts.get(`tg/${id}/${Number(rod.id)}`);
		assert(part?.kind === 'segment');
		expect(part.frame?.member).toEqual(rod);
	}
	expect(rods.filter((r) => r.id === '0' || r.id === '1').map((r) => r.b)).toEqual([
		chord.a,
		chord.b
	]);
}

function checkFrame(world: World) {
	const survey = frameSurvey(world);
	const mains = [...survey.seams.values()].filter(
		(s) => world.state.frameBays?.get(s.id)?.built === 'main'
	);
	for (const s of mains)
		expect(mains.some((n) => n.id !== s.id && n.vertices.some((v) => s.vertices.includes(v)))).toBe(
			true
		);
	let count = 0;
	for (const [id, bay] of world.state.frameBays ?? []) {
		if (!bay.built) continue;
		const site = survey.seams.get(id),
			result = world.state.frameInstallations?.get(id)?.result;
		assert(site && result?.status === 'sized');
		checkMembers(world, id, site.houses, result.rods);
		count++;
	}
	return count;
}

test('64 terrain seeds build seated columns and attached members beside real main partners', () => {
	let bays = 0;
	for (let seed = 0; seed < 64; seed++) {
		let world = frameCarrier(seed);
		for (let i = 0; i < 2; i++) world = applyEdit(world, { kind: 'advance', years: 1 });
		const count = checkFrame(world);
		expect(count).toBeGreaterThan(0);
		bays += count;
	}
	console.info('SUPPORT ' + JSON.stringify({ seeds: 64, bays, ticks: 2 }));
}, 60_000);
