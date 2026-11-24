import { createWorldReference, readWorldReference } from './index';

/** Round-trips a fixed address through a JSON consumer. */
export function example() {
	const address = createWorldReference('example-plan', 'plan-cell', 'cell/0,0/0');
	return readWorldReference(JSON.parse(JSON.stringify(address)));
}
