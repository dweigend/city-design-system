import { blockInputs, resolveParams } from './index';

export function example(): { height: number; width: number; complexity: number } {
	return resolveParams(blockInputs, { height: 40, width: 8.26 });
}
