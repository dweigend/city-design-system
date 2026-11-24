import { expect, test } from 'bun:test';
import {
	createPlanarTopology,
	readEdgeIncidence,
	readFaceUnionBoundary,
	readPlanarSubset,
	readVertexAdjacency
} from './index';

const west = { id: 'west', vertexIds: ['a', 'b', 'e', 'd'] };
const east = { id: 'east', vertexIds: ['b', 'c', 'f', 'e'] };
const north = { id: 'north', vertexIds: ['d', 'e', 'h', 'g'] };
const northeast = { id: 'northeast', vertexIds: ['e', 'f', 'i', 'h'] };

test('pairs sides by address and preserves the first incidence of every edge', () => {
	const faces = [west, east, north];
	const plan = createPlanarTopology(faces);
	expect(plan.faces.map(({ neighbors }) => neighbors)).toEqual([
		[null, 'east', 'north', null],
		[null, null, null, 'west'],
		['west', null, null, null]
	]);
	expect(plan.boundary.map((edge) => edge.join(''))).toEqual([
		'ab',
		'da',
		'bc',
		'cf',
		'fe',
		'eh',
		'hg',
		'gd'
	]);
	const edges = readEdgeIncidence(faces);
	expect(edges.map(({ from, to }) => from + to)).toEqual([
		'ab',
		'be',
		'ed',
		'da',
		'bc',
		'cf',
		'fe',
		'eh',
		'hg',
		'gd'
	]);
	expect(edges[1]).toMatchObject({ faceId: 'west', side: 1, opposite: { id: 'east', side: 3 } });
});

test('reads subsets in request order and turns removed neighbors into boundary sides', () => {
	const plan = createPlanarTopology([west, east, north]);
	const subset = readPlanarSubset(plan.faces, ['north', 'west', 'north']);
	expect(subset.faces.map(({ id, neighbors }) => [id, neighbors])).toEqual([
		['north', ['west', null, null, null]],
		['west', [null, null, 'north', null]]
	]);
	expect(subset.boundary.map((edge) => edge.join(''))).toEqual([
		'eh',
		'hg',
		'gd',
		'ab',
		'be',
		'da'
	]);
	expect(subset.hasVertex('e')).toBe(true);
	expect(subset.hasVertex('f')).toBe(false);
	expect(plan.faces[0].neighbors[1]).toBe('east');
});

test('walks a single ring, two joined faces, and an L-shaped union', () => {
	expect(readFaceUnionBoundary([{ id: 'west', vertexIds: ['d', 'a', 'b', 'e'] }])).toEqual(
		west.vertexIds
	);
	expect(readFaceUnionBoundary([east, west])).toEqual(['a', 'b', 'c', 'f', 'e', 'd']);
	expect(readFaceUnionBoundary([west, east, north])).toEqual([
		'a',
		'b',
		'c',
		'f',
		'e',
		'h',
		'g',
		'd'
	]);
	expect(readFaceUnionBoundary([west, east], () => false)).toBeUndefined();
	expect(readFaceUnionBoundary([west, northeast])).toBeUndefined();
	expect(readFaceUnionBoundary([west, east, north, northeast])).toBeUndefined();
});

test('reads vertex adjacency and separates perimeter edges from a face-classified cut', () => {
	const faces = [west, east, north, northeast];
	const center = (vertices: ReturnType<typeof readVertexAdjacency>) =>
		vertices.find(({ id }) => id === 'e');
	expect(center(readVertexAdjacency(faces))).toEqual({
		id: 'e',
		neighbors: ['b', 'd', 'f', 'h'],
		boundary: []
	});
	expect(readVertexAdjacency(faces)[0]).toEqual({
		id: 'a',
		neighbors: ['b', 'd'],
		boundary: ['b', 'd']
	});
	expect(
		center(
			readVertexAdjacency(
				faces,
				(first, second) => second !== null && (first === 'west' || second === 'west')
			)
		)?.boundary
	).toEqual(['b', 'd']);
});

test('keeps delimiter-containing IDs distinct and rejects a third incidence', () => {
	const faces = [
		{ id: 'first', vertexIds: ['a|b', 'c', 'd'] },
		{ id: 'second', vertexIds: ['b|c', 'a', 'e'] }
	];
	expect(readEdgeIncidence(faces)).toHaveLength(6);
	expect(createPlanarTopology(faces).faces.map(({ neighbors }) => neighbors)).toEqual([
		[null, null, null],
		[null, null, null]
	]);
	expect(() =>
		readEdgeIncidence([west, east, { id: 'third', vertexIds: ['b', 'e', 'j'] }])
	).toThrow(RangeError);
	expect(() => readEdgeIncidence([{ id: 'repeated', vertexIds: ['a', 'b', 'a'] }])).toThrow(
		RangeError
	);
});

test('snapshots an editable input ring and freezes the topology it owns', () => {
	const vertexIds = ['a', 'b', 'c'];
	const plan = createPlanarTopology([{ id: 'single', vertexIds }]);
	vertexIds[0] = 'changed';
	expect(plan.faces[0].vertexIds).toEqual(['a', 'b', 'c']);
	expect(Object.isFrozen(plan.faces[0].neighbors)).toBe(true);
	expect(Object.isFrozen(plan.boundary[0])).toBe(true);
});
