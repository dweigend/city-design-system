import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Mesh } from 'three';
import { routeSlope } from '../../logic/megastructure';
import { slopeMesh } from './slope-mesh';
test('both traversals project the same landing and tread solids at the same world positions', () => {
	const graph = {
		points: [
			[17, -12, 0.35],
			[26, -9, 3.45],
			[17, -6, 6.55]
		],
		links: [
			[0, 1],
			[1, 2]
		]
	} as const;
	function solids(from: number, to: number) {
		const route = routeSlope(graph, from, to);
		assert.ok(route);
		assert.deepEqual(route.nodes, [from, 1, to]);
		assert.equal(route.flights[0].count, 22);
		const model = slopeMesh(route, {
			pink: 'pink',
			blue: 'blue',
			paper: 'white',
			steel: 'grey',
			stock: 'grey',
			window: 'white',
			orange: 'orange',
			yellow: 'yellow'
		});
		return model.children
			.map((mesh) => {
				assert.ok(mesh instanceof Mesh);
				mesh.updateMatrix();
				return JSON.stringify([mesh.matrix.toArray(), mesh.geometry.parameters]);
			})
			.sort();
	}
	assert.deepEqual(solids(0, 2), solids(2, 0));
});
