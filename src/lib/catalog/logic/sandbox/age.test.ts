// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { applyEdit, createWorld, commit, startHistory, undo, withState, changes } from './index';
import { currentStacks, houseView, styleForYear } from './index';
import { focuses, levelFor } from '../presentation';
const town = createWorld(7);
test('the old town occupies a reproducible set of lower terrace building sites', () => {
	expect(town.state.stacks).toEqual(createWorld(7).state.stacks);
	expect(town.state.stacks.size).toBeGreaterThanOrEqual(150);
	expect(town.state.stacks.size).toBeLessThanOrEqual(300);
	for (const id of town.state.stacks.keys()) {
		expect(town.grid.cellsById.get(id)).toMatchObject({ buildable: true, zone: 'lower-terrace' });
		expect(town.state.storyParts.get(id)?.every((part) => part.built < town.state.year)).toBe(true);
	}
});
test('stock takes a new floor, ages alongside a line and undo restores both', () => {
	const id = [...town.state.stacks.keys()][0];
	const raised = applyEdit(town, { kind: 'raise', cellId: id, use: 'water' });
	const built = applyEdit(raised, {
		kind: 'line',
		transit: 'viaduct',
		cellIds: ['30/40', '40/40']
	});
	const year = built.state.year;
	expect(built.state.storyParts.get(id)?.at(-1)?.built).toBe(year);
	expect(built.state.lines[0].year).toBe(year);
	const aged = applyEdit(built, { kind: 'advance' });
	expect(levelFor('all', 'houses', year, aged.state.year)).toBe('pencil');
	expect(changes(built, aged).addedLines).toHaveLength(1);
	const back = withState(aged, undo(commit(startHistory(built.state), aged.state)).present);
	expect(levelFor('all', 'rail', year, back.state.year)).toBe('full');
});

test('an erased story returns one unit and rebuilding at its anchor creates a fresh ID', () => {
	const cellId = [...town.state.stacks.keys()][0];
	const edit = { kind: 'raise', use: 'water', cellId } as const;
	const built = applyEdit(town, edit),
		cleared = applyEdit(built, { kind: 'clear', cellId });
	const replaced = applyEdit(cleared, edit);
	const top = (world: typeof town) => world.state.storyParts.get(cellId)?.at(-1);
	expect(top(built)?.id).not.toBe(top(replaced)?.id);
	expect(top(built)?.anchor).toEqual(top(replaced)?.anchor);
	expect(cleared.state.store.water).toBe(1);
	expect(undo(commit(startHistory(built.state), cleared.state)).present.store).toEqual(
		built.state.store
	);
	expect([1900, 1979, 1980, 2026, 2027, 2028, 2029].map(styleForYear)).toEqual([
		'terrace',
		'terrace',
		'collage',
		'collage',
		'megastructure',
		'totem',
		'collage'
	]);
});

test('most occupied seed-7 parcels have a visibly oblique corner', () => {
	const occupied = town.grid.cells.filter((cell) => town.state.stacks.has(cell.id));
	const oblique = occupied.filter(({ corners }) =>
		corners.some((v, i) => {
			const a = corners[(i + 3) % 4],
				b = corners[(i + 1) % 4];
			const ux = a[0] - v[0],
				uy = a[1] - v[1],
				vx = b[0] - v[0],
				vy = b[1] - v[1];
			return (
				Math.abs(ux * vx + uy * vy) >
				Math.sin((7 * Math.PI) / 180) * Math.hypot(ux, uy) * Math.hypot(vx, vy)
			);
		})
	);
	expect(oblique.length).toBeGreaterThan(occupied.length / 2);
});

test('a new collage floor covers the old ridge and keeps its silhouette when it ages', () => {
	const cellId = [...town.state.stacks.keys()][0];
	const roof = cellId + '@' + ((town.state.stacks.get(cellId)?.length ?? 1) - 1) + ':ridge';
	const view = (world: typeof town) =>
		[
			...new Set(
				[...world.state.stacks.keys()].map((id) => world.grid.cellsById.get(id)?.chunk ?? '')
			)
		].flatMap((chunk) => houseView(world, currentStacks(world.state), chunk, focuses.all));
	const initial = view(town);
	expect(initial.find((p) => p.id === roof)).toMatchObject({ kind: 'polyline', role: 'bestand' });
	expect(initial.some((p) => p.detail && p.id.includes(':opening'))).toBe(true);
	const painted = applyEdit(town, { kind: 'raise', use: 'water', cellId });
	const fresh = view(painted);
	expect(fresh.some((p) => p.id === roof)).toBe(false);
	const tank = fresh.find((p) => p.kind === 'sphere' && p.role === 'neu');
	expect(tank).toBeDefined();
	const aged = view(applyEdit(painted, { kind: 'advance' }));
	expect(aged.find((p) => p.id === tank?.id)).toMatchObject({
		kind: 'sphere',
		role: 'bestand',
		token: '--paper'
	});
});
