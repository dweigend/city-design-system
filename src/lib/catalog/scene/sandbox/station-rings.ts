import type { Primitive } from '../../logic/parametrik/types';
import { flowToken } from '../../data/focus';

/** Open the stop platform and capsule chamber at their original surveyed seat and radius. */
export function roundedStops(parts: Primitive[]): Primitive[] {
	return parts.map((part) => {
		if (!/\/stop\/\d+$/.test(part.id) || (part.kind !== 'sphere' && part.kind !== 'cylinder'))
			return part.token === flowToken.people
				? { ...part, token: '--paper', finish: part.glass ? 'clear-acrylic' : 'metall-gebuerstet' }
				: part;
		const [x, y, z] = part.position;
		return {
			...part,
			kind: 'torus',
			axis: 'z',
			position: [x, y, part.kind === 'cylinder' ? z + part.height / 2 : z],
			token: '--paper',
			finish: 'metall-gebuerstet',
			radius: part.radius * 0.9,
			tube: part.radius * 0.1,
			edges: false
		};
	});
}
