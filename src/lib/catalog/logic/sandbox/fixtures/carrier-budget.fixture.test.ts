import { quadGrid, type QuadCell } from '../../quad-grid';
import {
	beginStroke,
	buildingPlots,
	createWorld,
	extendStroke,
	installationPosition,
	withState,
	type Anchor,
	type Installation
} from '../index';

const town = createWorld(7);
const tool = { kind: 'house', style: 'megastructure', use: 'water' } as const;
const plots = buildingPlots(town.grid);
const ids = ['83/47', '86/47', '87/47'];
const templateCells = ids.map((id) => {
	const cell = plots.cellsById.get(id);
	if (!cell) throw new Error('Missing carrier plot ' + id);
	return cell;
});
const frame = [ids[0], ids[2]].reduce(extendStroke, beginStroke(tool, town)).draft;
const template = [...frame.state.parts.values()];
const posts = template.filter((p) => p.recipe === 'chord' && p.anchor.cellId === p.end.cellId);
const crowns = posts.map((p) => {
	if (p.kind !== 'segment') throw new Error('Missing crown');
	return p.end;
});
const start = installationPosition(plots, crowns[0]),
	end = installationPosition(plots, crowns[2]);

/** Builds the review fixture with one unresolved group at the final bearing. */
export function singularCarrier(groups: number) {
	const cells: QuadCell[] = [],
		parts: Installation[] = [];
	const anchor = (a: Anchor, i: number) => ({ ...a, cellId: i + ':' + a.cellId });
	for (let i = 0; i <= groups; i++) {
		const shift = ([x, y, z]: QuadCell['center']): QuadCell['center'] => [
			x + i * (end[0] - start[0] + 5),
			y + i * (end[1] - start[1]),
			z
		];
		for (const cell of i === groups ? templateCells.slice(0, 1) : templateCells) {
			const [a, b, c, d] = cell.corners;
			cells.push({
				...cell,
				id: i + ':' + cell.id,
				index: cells.length,
				center: shift(cell.center),
				corners: [shift(a), shift(b), shift(c), shift(d)]
			});
		}
		if (i)
			parts.push({
				kind: 'segment',
				recipe: 'chord',
				anchor: anchor(crowns[2], i - 1),
				end: anchor(crowns[0], i)
			});
		if (i === groups) {
			const foot = anchor(posts[0].anchor, i);
			parts.push(
				{ kind: 'pillar', recipe: 'bearing', anchor: foot },
				{ kind: 'segment', recipe: 'chord', anchor: foot, end: anchor(crowns[0], i) }
			);
			break;
		}
		for (const part of template) {
			// Restore the original 16.738 m forward diagonal in each three-roof group.
			const foot =
				part.recipe === 'brace' && part.end.cellId === ids[1] && part.anchor.cellId !== ids[1]
					? posts[0].anchor
					: part.anchor;
			parts.push(
				part.kind === 'segment'
					? { ...part, anchor: anchor(foot, i), end: anchor(part.end, i) }
					: { ...part, anchor: anchor(foot, i) }
			);
		}
	}
	return { grid: quadGrid(cells), cells, parts };
}

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
