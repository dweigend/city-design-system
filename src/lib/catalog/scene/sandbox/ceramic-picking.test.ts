import { savedCarrier } from '../../logic/sandbox/fixtures/saved-carrier.fixture.test';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as T from 'three/webgpu';
import {
	beginStroke,
	applyEdit,
	createWorld,
	extendStroke,
	installationView,
	withState,
	type World
} from '../../logic/sandbox';
import { createCellPicker } from './house-picker';
import { projectInstallations, KEY } from './projection';
import { createView } from './view';
import { BLICK } from '../../data/leitstil';
import { contourWidthMeters } from './contour-width';
import { sandboxStyle } from './drafting-style';

async function structureLayer() {
	const shim = !('$state' in globalThis);
	if (shim)
		Object.defineProperty(globalThis, '$state', { configurable: true, value: (x: unknown) => x });
	try {
		return (await import('./structures')).createStructures();
	} finally {
		if (shim) Reflect.deleteProperty(globalThis, '$state');
	}
}
const world = createWorld(7);
const draw = (w: World, style: 'totem' | 'megastructure') =>
	['90/40', '94/40'].reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, w))
		.draft;
const frame = savedCarrier(world, '90/40', 'water'),
	installed = draw(frame, 'totem');

function ceramicOutlined(layer: Awaited<ReturnType<typeof structureLayer>>, key: string) {
	const [target] = layer.solids(key);
	assert(target instanceof T.Mesh);
	assert.equal(target.parent, null);
	assert.equal(target.userData.cellId, '90/40');
	const meshes = layer.group.children
		.flatMap((batch) => batch.children)
		.filter((face) => face instanceof T.Mesh);
	assert(meshes.some((face) => face.geometry === target.geometry));
	return meshes.some(
		(face) =>
			face.geometry.hasAttribute('outlineOffset') &&
			face.geometry.getAttribute('position') === target.geometry.getAttribute('position')
	);
}

test('installation rays hit the exposed body and lip, traverse the bore and respect nearer geometry', async () => {
	const layer = await structureLayer();
	const cover = new T.Mesh(new T.BoxGeometry(4, 1, 4), new T.MeshBasicMaterial());
	try {
		projectInstallations(layer, world, installed, 'all');
		const forms = installationView(installed, 'all');
		const lip = forms.find((p) => p.kind === 'mesh' && p.token === '--cat-health-3');
		assert(lip?.kind === 'mesh');
		const n = lip.points.length / 2;
		const [x, y, z] = lip.points[0],
			opposite = lip.points[n / 2];
		const cx = (x + opposite[0]) / 2,
			cy = (y + opposite[1]) / 2;
		const view = createView();
		view.resize(800, 600);
		view.target.set(cx, z, -cy);
		view.setPlan(true);
		const picker = createCellPicker(view);
		const hits = layer.solids(KEY.installation);
		const cell = (wx: number, wy: number, objects: T.Object3D[]) => {
			const pos = new T.Vector3(wx, z, -wy).project(view.camera);
			return world.grid.cells[
				picker((1 + pos.x) * 400, (1 - pos.y) * 300, world.grid, objects) ?? -1
			]?.id;
		};
		cover.userData.cellId = '89/42';
		cover.position.set(cx, z - 5, -cy);
		cover.updateMatrixWorld();
		const visible = [cover, ...hits];
		const lipX = (x + lip.points[n][0]) / 2,
			lipY = (y + lip.points[n][1]) / 2;
		assert.equal(cell(lipX, lipY, visible), '90/40');
		assert.equal(cell(cx + 1.13 * (x - cx), cy + 1.13 * (y - cy), visible), '90/40');
		assert.equal(cell(cx, cy, visible), '89/42');
		assert.equal(cell(lipX, lipY, [cover]), '89/42');
		cover.position.set(cx, z + 2, -cy);
		cover.updateMatrixWorld();
		cover.userData.cellId = '89/42';
		assert.equal(cell(lipX, lipY, [...hits, cover]), '89/42');
		projectInstallations(layer, installed, frame, 'all');
		assert.equal(cell(lipX, lipY, layer.solids(KEY.installation)), cell(lipX, lipY, []));
	} finally {
		layer.dispose();
		cover.geometry.dispose();
		cover.material.dispose();
	}
});

test('zoom exchanges only the ceramic batch; removing an unrelated module retains its pick targets', async () => {
	const layer = await structureLayer();
	try {
		projectInstallations(layer, world, installed, 'all');
		const ceramic = [...installed.state.parts.values()].find((p) => p.recipe === 'ceramic');
		const capsule = [...installed.state.parts.values()].find((p) => p.recipe === 'capsule');
		assert(ceramic && capsule);
		const solids = (id: string) => layer.solids(KEY.installation + id);
		const before = solids(ceramic.id);
		const parts = new Map(installed.state.parts);
		parts.delete(capsule.id);
		const edited = withState(installed, { ...installed.state, parts });
		projectInstallations(layer, installed, edited, 'all');
		assert.equal(solids(ceramic.id)[0], before[0]);
		assert.equal(solids(capsule.id).length, 0);
		const near = installationView(edited, 'all').find(
			(p) => p.kind === 'mesh' && p.token === '--paper'
		);
		const far = installationView(edited, 'all', true).find(
			(p) => p.kind === 'mesh' && p.token === '--paper'
		);
		assert(
			near?.kind === 'mesh' && far?.kind === 'mesh' && far.triangles.length < near.triangles.length
		);
		projectInstallations(layer, edited, edited, 'all', true);
		const coarse = solids(ceramic.id);
		assert.notEqual(coarse[0], before[0]);
		const style = sandboxStyle({ zoom: 'stadt', modus: 'ansehen', situation: 'normal' });
		layer.setStyle([style, 'all', 1], Math.PI / 4);
		const redrawn = solids(ceramic.id);
		assert(redrawn.length > 0 && redrawn[0] !== coarse[0]);
		assert(redrawn.every((hit) => hit.userData.cellId === ceramic.anchor.cellId));
	} finally {
		layer.dispose();
	}
});

test('city ceramic loses only its outline below six projected pixels', async () => {
	const layer = await structureLayer();
	try {
		const meshes = installationView(installed, 'all', true).filter((p) => p.kind === 'mesh');
		const body = meshes.find((p) => p.token === '--paper');
		assert(body && meshes.length === 2);
		const view = createView();
		view.resize(800, 600);
		const camera = view.camera;
		const widthPerNdc = (camera.right - camera.left) / (2 * camera.zoom);
		const screenX = body.points.map(
			([x, y, z]) => new T.Vector3(x, z, -y).project(camera).x * widthPerNdc
		);
		const horizontal = Math.max(...screenX) - Math.min(...screenX);
		const width = contourWidthMeters(body, BLICK.hoeheRad);
		assert(width <= horizontal + 1e-9 && horizontal * 1.7 < 4.75);
		const style = sandboxStyle({ zoom: 'stadt', modus: 'ansehen', situation: 'normal' });
		for (const mesh of meshes) layer.set(mesh.id + '#', [mesh], '90/40');
		for (const [scale, outlined] of [
			[1.7, false],
			[2.5, true]
		] as const) {
			layer.setStyle([style, 'all', scale], BLICK.hoeheRad);
			assert.equal(width * scale >= 6, outlined);
			for (const mesh of meshes) {
				const visible = ceramicOutlined(layer, mesh.id + '#');
				if (mesh === body) assert.equal(visible, outlined);
			}
		}
	} finally {
		layer.dispose();
	}
});

test('the city ceramic switches once in each zoom direction and starts fresh after clear', async () => {
	const layer = await structureLayer();
	try {
		const body = installationView(installed, 'all', true).find(
			(p) => p.kind === 'mesh' && p.token === '--paper'
		);
		assert(body);
		const style = sandboxStyle({ zoom: 'stadt', modus: 'ansehen', situation: 'normal' });
		for (const elevation of [BLICK.hoeheRad, (11 * Math.PI) / 180, Math.PI / 2]) {
			const boundary = 6 / contourWidthMeters(body, elevation);
			const setScale = (ratio: number) =>
				layer.setStyle([style, 'all', boundary * ratio], elevation);
			const visible = () => ceramicOutlined(layer, 'body');
			layer.clear();
			setScale(1);
			layer.set('body', [body], '90/40');
			const sweep = [1, 0.999, 1.001, 0.9, 0.899, 0.999, 1.001, 0.999, 1.1, 1.101, 1.001, 0.999];
			const states = sweep.map((r) => {
				setScale(r);
				return visible();
			});
			assert.deepEqual(states, [
				true,
				true,
				true,
				true,
				false,
				false,
				false,
				false,
				false,
				true,
				true,
				true
			]);
			layer.clear();
			layer.set('body', [body], '90/40');
			assert.equal(visible(), false);
		}
	} finally {
		layer.dispose();
	}
});

test('town eraser selects a skywalk podium before the stock roof below it', async () => {
	const layer = await structureLayer();
	const cellId = '30/35';
	const houseId = '31/35';
	const id = 'p/0/0';
	const podium = withState(world, {
		...world.state,
		stacks: new Map([[houseId, ['living']]]),
		parts: new Map([
			[
				id,
				{
					id,
					owner: 'c/0',
					kind: 'stop',
					recipe: 'plaza',
					built: world.state.year,
					anchor: { cellId, level: 2, lift: 1 },
					materials: {}
				}
			]
		])
	});
	try {
		projectInstallations(layer, world, podium, 'all');
		const box = installationView(podium, 'all')[0];
		assert(box.kind === 'box');
		const [x, y, z] = box.position;
		const view = createView();
		view.resize(800, 600);
		view.target.set(x + box.size[0] / 2, z + box.size[2], -y - box.size[1] / 2);
		view.pan(0, 0);
		const roof = new T.Mesh(new T.BoxGeometry(4, 0.2, 4), new T.MeshBasicMaterial());
		try {
			const ray = new T.Raycaster();
			ray.setFromCamera(view.ndc(400, 300), view.camera);
			const point = ray.ray.intersectPlane(
				new T.Plane(new T.Vector3(0, 1, 0), 2 - z),
				new T.Vector3()
			);
			assert(point);
			roof.position.copy(point);
			roof.userData.cellId = houseId;
			roof.updateMatrixWorld();
			const picker = createCellPicker(view);
			const pick = (targets: T.Object3D[]) =>
				world.grid.cells[picker(400, 300, world.grid, targets) ?? -1]?.id;
			assert.equal(pick([roof]), houseId);
			const picked = pick([roof, ...layer.solids(KEY.installation)]);
			assert.equal(picked, cellId);
			const erased = applyEdit(podium, { kind: 'clear', cellId: picked });
			assert.equal(erased.state.parts.has(id), false);
			assert.equal(erased.state.stacks.get(houseId), podium.state.stacks.get(houseId));
		} finally {
			roof.geometry.dispose();
			roof.material.dispose();
		}
	} finally {
		layer.dispose();
	}
});
