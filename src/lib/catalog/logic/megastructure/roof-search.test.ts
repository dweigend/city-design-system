import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildRoofFrame, planRoofFrame, type RoofCell } from './index';
import { selectConnectedLayout } from './connected-layouts';
import type { RoofLink } from './roof-links';

function rect(id: string, x: number, y: number, w: number, h: number): RoofCell {
	return {
		id,
		height: 4,
		polygon: [
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h]
		]
	};
}
function reviewRow(n: number) {
	return [
		rect('a', 0, 0, 4, 12),
		rect('b', 0, -12.5, 4, 12),
		rect('c', 0, 12.5, 4, 12),
		...Array.from({ length: n - 3 }, (_, i) =>
			rect(String(i).padStart(2, '0'), -6.5 - 2.5 * i, 4, 2, 4)
		)
	];
}
for (const n of [13, 30])
	test('conflicting bridge bearings in the ' + n + '-roof review row take under 50 ms', () => {
		const roofs = reviewRow(n),
			start = performance.now();
		const result = planRoofFrame(roofs, { maxSpan: 7 });
		const elapsed = performance.now() - start;
		assert.equal(result.status, 'incompatible-bridge-bearings');
		assert.ok(elapsed < 50, `${n} roofs took ${elapsed.toFixed(2)} ms`);
	});
test('disconnected span graph identifies independent groups before choosing bearings', () => {
	const roofs = [rect('c', 100, 0, 2, 4), rect('b', 4, 0, 2, 4), rect('a', 0, 0, 2, 4)];
	assert.deepEqual(planRoofFrame(roofs, { maxSpan: 7 }), {
		status: 'span-disconnected',
		components: [['a', 'b'], ['c']]
	});
});
function edge(a: number, b: number, left: number, right: number): RoofLink {
	const pairs = new Uint8Array(4);
	pairs[left * 2 + right] = 1;
	return { a, b, pairs, columns: 2 };
}
test('an alternative spanning tree can route around incompatible preferred tree edges', () => {
	const edges = [edge(0, 1, 0, 0), edge(0, 2, 1, 1), edge(1, 2, 0, 1)];
	// Only the 0-1, 1-2 tree works for the preferred option on roof 0.
	assert.equal(selectConnectedLayout([2, 2, 2], edges).status, 'connected');
});
test('a five-cycle finds a compatible tree in either input order', () => {
	const links = [
		edge(0, 1, 1, 0),
		edge(1, 2, 1, 0),
		edge(2, 3, 0, 0),
		edge(3, 4, 0, 0),
		edge(0, 4, 0, 0)
	];
	const sizes = [2, 2, 2, 2, 2];
	// Omitting 0-1 leaves a feasible spanning tree.
	assert.deepEqual(selectConnectedLayout(sizes, links.slice(1)), {
		status: 'connected',
		choices: [0, 1, 0, 0, 0]
	});
	for (const order of [links, [...links].reverse()])
		assert.deepEqual(selectConnectedLayout(sizes, order), {
			status: 'connected',
			choices: [0, 1, 0, 0, 0]
		});
});
test('more than two independent cycles use only the primary tree', () => {
	const links = [
		edge(0, 1, 0, 1),
		edge(1, 2, 0, 1),
		edge(2, 3, 0, 1),
		edge(0, 3, 0, 1),
		edge(0, 2, 0, 0),
		edge(1, 3, 0, 0)
	];
	assert.deepEqual(selectConnectedLayout([2, 2, 2, 2], links), {
		status: 'tree-layout-unresolved',
		treesTried: 1
	});
});
for (const n of [13, 30])
	test('a connected row of ' + n + ' roofs assembles and solves under 50 ms', () => {
		const roofs = Array.from({ length: n }, (_, i) =>
			rect(String(i).padStart(2, '0'), i * 5, 0, 2, 4)
		);
		const start = performance.now(),
			result = planRoofFrame(roofs, { maxSpan: 7 }),
			elapsed = performance.now() - start;
		assert.equal(result.status, 'assembled');
		assert.equal(result.frame.analysis.status, 'ok');
		assert.ok(elapsed < 50, `${n} roofs took ${elapsed.toFixed(2)} ms`);
	});

test('five review roofs connect through the second cycle at an 11 m span', () => {
	const roofs = [
		{ ...rect('a', 14, 1, 7, 4), height: 5 },
		rect('b', 1, 14, 6, 7),
		rect('c', 20, 20, 8, 8),
		{ ...rect('d', 12, 10, 11, 7), height: 5 },
		{ ...rect('e', 7, 7, 11, 2), height: 6 }
	];
	const result = buildRoofFrame(roofs, { maxSpan: 11 });
	assert.equal(result.status, 'assembled');
	assert.equal(result.frame.analysis.status, 'ok');
	assert.deepEqual(buildRoofFrame([...roofs].reverse(), { maxSpan: 11 }), result);
	assert.deepEqual(buildRoofFrame([]), { status: 'empty-survey' });
});

function incompatibleRing(ids: number[]) {
	return ids.map((a, i) => {
		const b = ids[(i + 1) % ids.length];
		return a < b ? edge(a, b, 0, 1) : edge(b, a, 1, 0);
	});
}
test('two cycles exhaust all 64 trees at the product limit and report uncertainty above it', () => {
	const first = incompatibleRing(Array.from({ length: 8 }, (_, i) => i));
	for (const n of [8, 9]) {
		const second = incompatibleRing([0, ...Array.from({ length: n - 1 }, (_, i) => i + 8)]);
		const result = selectConnectedLayout(Array(n + 7).fill(2), [...first, ...second]);
		assert.deepEqual(
			result,
			n === 8
				? { status: 'incompatible-cycle-bearings', treesTried: 64 }
				: { status: 'tree-layout-unresolved', treesTried: 1 }
		);
	}
});

test('two triangles sharing an edge exhaust eight distinct spanning trees', () => {
	const links = [...incompatibleRing([0, 1, 2]), edge(0, 3, 0, 1), edge(2, 3, 1, 0)];
	assert.deepEqual(selectConnectedLayout(Array(4).fill(2), links), {
		status: 'incompatible-cycle-bearings',
		treesTried: 8
	});
});
