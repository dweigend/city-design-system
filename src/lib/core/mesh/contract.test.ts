import { expect, test } from 'bun:test';
import { example } from './example';
import { createMeshObject, mesh } from './index';

test('retains metric width and geometry when appending another mesh', () => {
	const ribbon = example();
	expect(ribbon.footprint).toEqual({ width: 4, depth: 1 });
	const { shape } = ribbon.parts[0];
	if (shape.kind !== 'mesh') throw Error('Expected ribbon mesh');
	const merged = mesh();
	merged.append(shape);
	expect(createMeshObject('ribbon', { deck: merged }, [])).toEqual(ribbon);
});
