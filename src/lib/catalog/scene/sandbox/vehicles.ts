import * as THREE from 'three/webgpu';
import { mix, normalLocal, positionLocal, uniform } from 'three/tsl';
import type { Palette3D } from '../../data/city3d';
import { focuses, type FocusId } from '../../logic/presentation';
import { houseObstacles, type World } from '../../logic/sandbox';
import { kreisSegmente } from '../../logic/parametrik/rundung';
import { VEHICLE, vehiclePoses } from '../../logic/transit-line';

type Route = {
	line: World['lines'][number];
	cars: THREE.Mesh[];
	clearance: THREE.Box3[];
};

const UP = new THREE.Vector3(0, 1, 0);

/** Owns the sandbox's vehicle meshes and samples their shared transit poses. */
export function createVehicles() {
	const group = new THREE.Group();
	const material = new THREE.MeshBasicNodeMaterial();
	const livery = uniform(new THREE.Color());
	const ivory = uniform(new THREE.Color());
	// A porcelain waist between the two coloured end caps makes the moving pod legible on its rail.
	const waist = positionLocal.y.abs().smoothstep(0.48, 0.54);
	material.colorNode = mix(ivory, livery, waist).mul(normalLocal.x.mul(0.08).add(0.92));
	const ghost = new THREE.MeshBasicNodeMaterial({
		transparent: true,
		opacity: 0.16,
		depthWrite: false
	});
	const geometries = {
		viaduct: vehicleGeometry(VEHICLE.viaduct),
		capsule: vehicleGeometry(VEHICLE.capsule)
	};
	const routes = new Map<string, Route>();
	const direction = new THREE.Vector3();

	function vehicleGeometry({ length, radius }: (typeof VEHICLE)['viaduct']) {
		const segments = kreisSegmente(radius);
		return new THREE.CapsuleGeometry(radius, length - 2 * radius, segments / 4, segments);
	}

	function removeRoute(route: Route) {
		group.remove(...route.cars);
		routes.delete(route.line.id);
	}

	function setLine(line: Route['line']) {
		const previous = routes.get(line.id);
		if (previous) {
			if (previous.line === line) return;
			removeRoute(previous);
		}
		const cars = vehiclePoses(line, 0).map(() => new THREE.Mesh(geometries[line.kind], material));
		group.add(...cars);
		routes.set(line.id, { line, cars, clearance: [] });
	}

	function setWorld(world: World) {
		const lines = world.lines;
		sampledMs = undefined;
		const ids = new Set(lines.map(({ id }) => id));
		for (const [id, route] of routes) if (!ids.has(id)) removeRoute(route);
		for (const line of lines) setLine(line);
		const stock = houseObstacles(world.grid, world.state).map(
			({ position: [x, y, z], size: [w, d, h] }) =>
				new THREE.Box3(
					new THREE.Vector3(x - w / 2, z, -y - d / 2),
					new THREE.Vector3(x + w / 2, z + h, -y + d / 2)
				)
		);
		for (const route of routes.values()) {
			const corridor = new THREE.Box3().setFromPoints(
				route.line.path.map(([x, y, z]) => new THREE.Vector3(x, z, -y))
			);
			corridor.expandByScalar(VEHICLE[route.line.kind].length);
			route.clearance = stock.filter((box) => corridor.intersectsBox(box));
		}
	}

	const swept = new THREE.Box3();
	const bounds = new THREE.Box3();
	function carBounds(car: THREE.Mesh) {
		const geometry = car.geometry;
		if (!geometry.boundingBox) geometry.computeBoundingBox();
		car.updateMatrix();
		return geometry.boundingBox
			? bounds.copy(geometry.boundingBox).applyMatrix4(car.matrix)
			: bounds.makeEmpty();
	}
	let sampledMs: number | undefined;
	function step(timeMs: number) {
		swept.makeEmpty();
		if (timeMs === sampledMs) return false;
		sampledMs = timeMs;
		for (const { line, cars, clearance } of routes.values()) {
			const poses = vehiclePoses(line, timeMs / 1000);
			poses.forEach(({ position: [x, y, z], headingRad, pitchRad }, index) => {
				const car = cars[index];
				if (car.visible) swept.union(carBounds(car));
				car.position.set(x, z, -y);
				direction.set(
					Math.cos(headingRad) * Math.cos(pitchRad),
					Math.sin(pitchRad),
					-Math.sin(headingRad) * Math.cos(pitchRad)
				);
				car.quaternion.setFromUnitVectors(UP, direction);
				const box = carBounds(car);
				car.visible = !clearance.some((stock) => stock.intersectsBox(box));
				if (car.visible) swept.union(box);
			});
		}
		return !swept.isEmpty();
	}

	return {
		group,
		setWorld,
		/** Updates car ink to match the selected rail focus. */
		setFocus(focus: FocusId) {
			const inks = { full: material, transparent: ghost };
			const ink = inks[focuses[focus].rail];
			for (const { cars } of routes.values()) for (const car of cars) car.material = ink;
		},
		swept,
		step,
		/** Uses paper and graphite for transit livery. */
		setPalette(palette: Palette3D) {
			ivory.value.set(palette.paper);
			livery.value.set(palette.ink).lerp(ivory.value, 0.28);
			ghost.color.set(palette.ink);
		},
		/** Releases the shared mesh resources. */
		dispose() {
			group.clear();
			for (const geometry of Object.values(geometries)) geometry.dispose();
			material.dispose();
			ghost.dispose();
		}
	};
}
