import type { Primitive } from '../../logic/parametrik/types';

/** Open the stop platform and capsule chamber at their original surveyed seat and radius. */
export function roundedStops(parts: Primitive[]): Primitive[] {
	return parts.map((part) => {
		if (!/\/stop\/\d+$/.test(part.id) || (part.kind !== 'sphere' && part.kind !== 'cylinder'))
			return part;
		const [x, y, z] = part.position;
		return {
			...part,
			kind: 'torus',
			axis: 'z',
			position: [x, y, part.kind === 'cylinder' ? z + part.height / 2 : z],
			radius: part.radius * 0.9,
			tube: part.radius * 0.1,
			edges: false
		};
	});
}
