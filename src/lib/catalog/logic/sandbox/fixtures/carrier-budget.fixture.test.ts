import { beginStroke, createWorld, extendStroke, withState } from '../index';
const town = createWorld(7);
const tool = { kind: 'house', style: 'megastructure', use: 'water' } as const;
/** Prepares each pointer move from its previous stroke state. */
export function tenRoofStroke() {
	const roofs = Array.from({ length: 10 }, (_, i) => 30 + 2 * i + '/40');
	const world = withState(town, {
		...town.state,
		stacks: new Map(roofs.map((id) => [id, ['living'] as const]))
	});
	let stroke = beginStroke(tool, world);
	const moves = roofs.map((id) => {
		const previous = stroke;
		const move = () => extendStroke(previous, id);
		stroke = move();
		return move;
	});
	return { stroke, moves };
}
