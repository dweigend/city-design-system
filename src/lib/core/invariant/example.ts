import { required } from './index';

export function example(): string {
	const blockId = 'block-7';
	return required(blockId, 'block id');
}
