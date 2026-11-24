import { createWorldReference, encodeKey, readWorldReference } from './index';

/** Round-trips a keyed address through a JSON consumer. */
export function example() {
	const key = encodeKey(['cell/0,0', 0]);
	const address = createWorldReference('example-plan', 'plan-cell', key);
	return readWorldReference(JSON.parse(JSON.stringify(address)));
}
