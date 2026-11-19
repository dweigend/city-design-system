import { isStructural, type Primitive } from '../../logic/parametrik/types';

type Stroke = Extract<Primitive, { kind: 'polyline' }>;

/** The two surveyed end profiles follow the counterclockwise footprint. Bridge their pitches
 * until the fitted roof mesh arrives, and draw only the eaves, ridge and gable creases. */
function gabledRoof(first: Stroke, second: Stroke): Primitive {
	return {
		role: first.role,
		material: first.material,
		token: first.token,
		roofCell: first.roofCell,
		id: first.id.replace(/:gable0$/, ':roof'),
		kind: 'mesh',
		points: [...first.points, ...second.points],
		triangles: [0, 2, 1, 3, 5, 4, 2, 3, 4, 2, 4, 1, 5, 0, 1, 5, 1, 4],
		lines: [
			[0, 1, 2, 3, 4, 5, 0],
			[1, 4]
		]
	};
}

const shells = new Set(['prism', 'cylinder', 'box', 'capsule', 'mesh']);

/** Keeps each surveyed shell, roof and stilt and omits fine openings and roof wires. */
export function townStock(stock: Primitive[]) {
	const visible: Primitive[] = [];
	const first = new Map<string, Stroke>();
	for (const part of stock) {
		if (part.detail || part.planned || isStructural(part)) continue;
		if (part.kind === 'polyline' && part.roofCell) {
			if (part.id.endsWith(':gable0')) first.set(part.roofCell, part);
			const end = first.get(part.roofCell);
			if (part.id.endsWith(':gable1') && end) visible.push(gabledRoof(end, part));
		} else if (shells.has(part.kind)) {
			visible.push(part);
		}
	}
	return visible;
}
