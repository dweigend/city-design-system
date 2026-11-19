import { expect, test } from 'bun:test';
import { BackSide, Mesh, MeshBasicNodeMaterial, Raycaster } from 'three/webgpu';
import {
	applyStroke,
	commit,
	createWorld,
	startHistory,
	undo,
	withState,
	type World
} from '../../logic/sandbox';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import { createCellPicker } from './house-picker';
import { loadStructureModules } from './fixtures/structure-modules';
import { projectChanges } from './projection';
import { createTerrainMesh } from './terrain-mesh';
import { createTerrainPicker } from './terrain-pick';
import { createView } from './view';

const cellId = '86/43';
const base = createWorld(7);
const cell = base.grid.cellsById.get(cellId);
if (!cell) throw new Error('Missing the stock house parcel');

const paint = () =>
	applyStroke(base, { kind: 'house', style: 'collage', use: 'water' }, [cellId]).draft;
const erase = (world: World) => applyStroke(world, { kind: 'erase' }, [cellId]).draft;

function projection() {
	const terrain = createTerrainMesh(base.grid);
	const drawn = new Map<string, Primitive[]>();
	const target = { terrain, structures: { set: drawn.set.bind(drawn) } };
	return {
		draw: (before: World, after: World) => projectChanges(target, before, after, 'all', false),
		parts: () => [...drawn.values()].flat().filter((part) => part.id.startsWith(cellId + '@')),
		allParts: () => [...drawn.values()].flat(),
		dispose: () => terrain.dispose()
	};
}

test('painting a water story adds a colour body and white plate above pencil stock', () => {
	const scene = projection();
	try {
		scene.draw(base, paint());
		const parts = scene.parts();
		expect(parts.find((part) => part.id === cellId + '@3:wall')).toMatchObject({
			kind: 'prism',
			role: 'neu',
			envelope: true,
			token: '--cat-health'
		});
		expect(parts.find((part) => part.id === cellId + '@3:plate')?.token).toBe('--paper');
		expect(
			scene.allParts().find((part) => part.id.endsWith(':wall') && part.role === 'bestand')
		).toMatchObject({
			role: 'bestand',
			token: '--paper'
		});
	} finally {
		scene.dispose();
	}
});

test('a ray hits the coloured wall mesh and picks its parcel', async () => {
	const [, , { createStructures }] = await loadStructureModules();
	const layer = createStructures();
	const scene = projection();
	try {
		scene.draw(base, paint());
		const wall = scene.parts().find((part) => part.id === cellId + '@3:wall');
		if (wall?.kind !== 'prism') throw new Error('Missing the colour body wall');
		layer.set('wall', [wall]);
		const solids = layer.solids('wall');
		const [solid] = solids;
		if (!(solid instanceof Mesh)) throw new Error('Missing the wall pick mesh');
		expect(solid.geometry.getAttribute('color')).toBeDefined();
		const position = solid.geometry.getAttribute('position');
		const contours: Mesh[] = [];
		layer.group.traverse((object) => {
			if (
				object instanceof Mesh &&
				object.geometry.getAttribute('position') === position &&
				object.material instanceof MeshBasicNodeMaterial &&
				object.material.side === BackSide
			)
				contours.push(object);
		});
		expect(contours).toHaveLength(1);
		const view = createView();
		view.resize(800, 600);
		const pointOnWall: Vec3 = [cell.center[0], cell.center[1], wall.z + wall.height];
		view.target.set(pointOnWall[0], pointOnWall[2], -pointOnWall[1]);
		view.setPlan(true);
		const point = view.project(pointOnWall);
		const ray = new Raycaster();
		ray.setFromCamera(view.ndc(point.x, point.y), view.camera);
		const [hit] = ray.intersectObjects(solids, false);
		expect(hit?.object).toBe(solid);
		const terrain = createTerrainPicker();
		terrain.setGrid(base.grid);
		expect(terrain.pick(ray.ray, hit.distance)).toBeUndefined();
		expect(createCellPicker(view)(point.x, point.y, base.grid, solids)).toBe(cell.index);
	} finally {
		layer.dispose();
		scene.dispose();
	}
});

test('erasing a colour body removes its geometry and credits its use', () => {
	const scene = projection();
	try {
		const built = paint();
		const cleared = erase(built);
		scene.draw(base, built);
		scene.draw(built, cleared);
		expect(scene.parts().some((part) => part.id.startsWith(cellId + '@3:'))).toBe(false);
		expect(cleared.state.stacks.get(cellId)).toEqual(base.state.stacks.get(cellId));
		expect(cleared.state.store.water).toBe(built.state.store.water + 1);
	} finally {
		scene.dispose();
	}
});

test('undoing an erase restores the same colour body and story identity', () => {
	const scene = projection();
	try {
		const built = paint();
		const cleared = erase(built);
		scene.draw(base, built);
		const fresh = scene.parts();
		expect(fresh.some((part) => part.id === cellId + '@3:wall')).toBe(true);
		scene.draw(built, cleared);
		const history = commit(startHistory(built.state), cleared.state);
		const restored = withState(cleared, undo(history).present);
		scene.draw(cleared, restored);
		expect(restored.state.storyParts.get(cellId)).toBe(built.state.storyParts.get(cellId));
		expect(scene.parts()).toEqual(fresh);
	} finally {
		scene.dispose();
	}
});
