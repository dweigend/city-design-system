import * as THREE from 'three/webgpu';
import { flowToken } from '../../data/focus';
import type { Palette3D } from '../../data/city3d';
import type { Vec3 } from '../../logic/parametrik/types';
import type { World } from '../../logic/sandbox';
import { sceneSwatch } from '../scene-palette';
import { polylineObject } from './polylines';

const DISC_SIDES = 12;

function nodeDiscs(points: readonly Vec3[], radiusM: number) {
	const vertices: number[] = [];
	for (const [x, y, z] of points) {
		for (let i = 0; i < DISC_SIDES; i++) {
			vertices.push(x, z, -y);
			for (const corner of [i, i + 1]) {
				const angle = (corner * 2 * Math.PI) / DISC_SIDES;
				vertices.push(x + radiusM * Math.cos(angle), z, -y - radiusM * Math.sin(angle));
			}
		}
	}
	return new THREE.BufferGeometry().setAttribute(
		'position',
		new THREE.Float32BufferAttribute(vertices, 3)
	);
}

/** Retains a flat overlay of the paths and stations already supplied by the world. */
export function createSchematicLayer() {
	const group = new THREE.Group();
	group.visible = false;
	const paths = new THREE.Line2NodeMaterial({
		linewidth: 1.4,
		depthTest: false,
		depthWrite: false
	});
	const tracks = new THREE.Line2NodeMaterial({
		linewidth: 2.8,
		depthTest: false,
		depthWrite: false
	});
	const stops = new THREE.MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
	const rims = new THREE.MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
	const materials = [paths, tracks, stops, rims];
	const geometries: THREE.BufferGeometry[] = [];

	function clear() {
		group.clear();
		for (const geometry of geometries) geometry.dispose();
		geometries.length = 0;
	}

	function add(object: THREE.Mesh, order: number) {
		object.renderOrder = order;
		group.add(object);
		geometries.push(object.geometry);
	}

	function drawPaths(routes: readonly (readonly Vec3[])[], material: typeof paths, order: number) {
		const segments = routes.flatMap((path) =>
			path.slice(1).map((point, i) => [path[i], point] as const)
		);
		const line = polylineObject(segments, material);
		if (line) add(line, order);
	}

	return {
		group,
		/** Rebuilds when the world supplies different connections. */
		rebuild(world: World) {
			clear();
			const walk = (world.state.city?.walk ?? []).flatMap((ids) =>
				ids.slice(1).flatMap((id, index) => {
					const start = world.grid.cellsById.get(ids[index]);
					const end = world.grid.cellsById.get(id);
					return start && end ? [[start.center, end.center]] : [];
				})
			);
			drawPaths(walk, paths, 18);
			drawPaths(
				world.lines.map((line) => line.path),
				tracks,
				19
			);
			const nodes = world.lines.flatMap((line) => line.stops.map((stop) => stop.position));
			if (!nodes.length) return;
			add(new THREE.Mesh(nodeDiscs(nodes, 1.85), rims), 20);
			add(new THREE.Mesh(nodeDiscs(nodes, 1.1), stops), 21);
		},
		/** Resolves the existing movement flow token through the active palette. */
		setPalette(palette: Palette3D) {
			const people = new THREE.Color(sceneSwatch(palette, flowToken.people));
			rims.color.copy(people);
			tracks.color.copy(people).lerp(new THREE.Color(palette.ink), 0.32);
			paths.color.copy(people);
			stops.color.set(palette.paper);
		},
		/** Releases retained path buffers and drawing materials. */
		dispose() {
			clear();
			for (const material of materials) material.dispose();
		}
	};
}
