import { describe, expect, test } from 'bun:test';
import { shapeArrays } from '../../lib/scene/stage';
import { createSchematic, readSchematicRoute, routePairs } from './schematic';

const cases = [
	{
		level: 0,
		nodes: 8,
		edges: 8,
		elevated: 0,
		climbM: 0,
		levelChanges: 0,
		courtM: 162.38,
		quayM: 176.2,
		westEdges: ['gate-detour', 'south-yard', 'west-bank']
	},
	{
		level: 1,
		nodes: 10,
		edges: 11,
		elevated: 3,
		climbM: 7,
		levelChanges: 2,
		courtM: 144,
		quayM: 157.82,
		westEdges: ['lower-gate-stair', 'lower-deck', 'lower-bridge-stair']
	},
	{
		level: 2,
		nodes: 12,
		edges: 14,
		elevated: 6,
		climbM: 14,
		levelChanges: 2,
		courtM: 124.28,
		quayM: 138.1,
		westEdges: ['upper-gate-stair', 'upper-deck', 'upper-bridge-stair']
	}
] as const;

describe('Paths teaching schematic', () => {
	test('the page and its graph have no city or valley dependency', async () => {
		for (const file of ['./schematic.ts', './+page.svelte']) {
			const source = await Bun.file(new URL(file, import.meta.url)).text();
			expect(source).not.toMatch(
				/\b(?:CitySite|CityGrid|CityColumns?|ValleyDemo|createCitySite|readCityGrid|readCityColumns)\b|(?:world\/(?:city-site|city-movement)|domain\/(?:city-volume|valley)|scene\/(?:city-volume-projection|valley-projection))/
			);
		}
	});

	test.each(cases)(
		'level $level connects only active nodes and unlocks its shortcut',
		(example) => {
			const { network, elevatedEdges } = createSchematic(example.level);
			expect(network.nodes).toHaveLength(example.nodes);
			expect(network.edges).toHaveLength(example.edges);
			expect(elevatedEdges).toBe(example.elevated);
			expect(new Set(network.readComponents().values()).size).toBe(1);
			expect(network.edges.filter(({ kind }) => kind === 'bridge').map(({ id }) => id)).toEqual([
				'river-bridge'
			]);

			expect(network.nodes.every(({ level }) => level === 'ground' || level <= example.level)).toBe(
				true
			);
			expect(network.edges.every(({ lengthM }) => lengthM > 0)).toBe(true);
		}
	);

	test.each(cases)(
		'level $level measures and projects both shortest routes deterministically',
		(example) => {
			const schematic = createSchematic(example.level);
			const repeat = createSchematic(example.level);
			expect(repeat.network.nodes).toEqual(schematic.network.nodes);
			expect(repeat.network.edges).toEqual(schematic.network.edges);
			expect(repeat.drawables).toEqual(schematic.drawables);

			for (const pair of routePairs) {
				const result = readSchematicRoute(schematic, pair);
				const { route, levelChanges, drawables } = result;
				const eastEdges = pair.value === 'court' ? ['court-lane'] : ['east-bank', 'quay-lane'];
				expect(route.nodes[0]).toBe(pair.from);
				expect(route.nodes.at(-1)).toBe(pair.to);
				expect(route.edges.map(({ id }) => id)).toEqual([
					...example.westEdges,
					'river-bridge',
					...eastEdges
				]);
				expect(route.lengthM).toBeCloseTo(pair.value === 'court' ? example.courtM : example.quayM);
				expect(route.climbM).toBe(example.climbM);
				expect(levelChanges).toBe(example.levelChanges);
				expect(readSchematicRoute(repeat, pair)).toEqual(result);

				expect(drawables).toHaveLength(1);
				expect(drawables[0].strokeSegments).toHaveLength(route.edges.length * 6);
				const combined = [...schematic.drawables, ...drawables];
				expect(new Set(combined.map(({ id }) => id)).size).toBe(combined.length);
				for (const { shape, strokeSegments } of combined) {
					const { positions, indices } = shapeArrays(shape);
					expect(positions.length).toBeGreaterThan(0);
					expect(positions.every(Number.isFinite)).toBe(true);
					expect(indices.length).toBeGreaterThan(0);
					expect(indices.every((index) => index >= 0 && index * 3 < positions.length)).toBe(true);
					expect((strokeSegments ?? []).every(Number.isFinite)).toBe(true);
				}
			}
		}
	);
});
