import { bounds, size, type Bounds3, type Vec3 } from './index';
import { required } from '../invariant';

export function example(): { bounds: Bounds3; size: Vec3 } {
	const envelope = required(
		bounds([
			[1, 2, 0],
			[10, 5, 4]
		]),
		'example bounds'
	);
	return { bounds: envelope, size: size(envelope) };
}
