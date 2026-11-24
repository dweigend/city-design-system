import { expect, test } from 'bun:test';
import { createWorldReference, readWorldReference } from './index';

test('round-trips opaque kinds and keys and rejects unusable versions and fields', () => {
	const address = createWorldReference('plan/1', 'sister/stop', 'x|y\n"z"');
	expect(readWorldReference(JSON.parse(JSON.stringify(address)))).toEqual(address);
	expect(readWorldReference({ ...address, v: 2 })).toBeUndefined();
	expect(readWorldReference({ ...address, world: '' })).toBeUndefined();
	expect(readWorldReference({ ...address, key: 3 })).toBeUndefined();
});
