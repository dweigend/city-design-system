import * as THREE from 'three/webgpu';
import { mix, normalLocal, positionLocal, uniform } from 'three/tsl';
import { flowToken } from '../../data/focus';
import type { Palette3D } from '../../data/city3d';
import { levelFor, type FocusId } from '../../logic/presentation';
import type { World } from '../../logic/sandbox';
import { kreisSegmente } from '../../logic/parametrik/rundung';
import { VEHICLE, vehiclePoses } from '../../logic/transit-line';

type Route = {
	line: World['lines'][number];
	startMs: number;
	cars: THREE.Mesh[];
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
	const pencil = new THREE.MeshBasicNodeMaterial();
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

	function setLine(line: Route['line'], timeMs: number) {
		const previous = routes.get(line.id);
		const startMs = previous ? previous.startMs : timeMs;
		if (previous) {
			if (previous.line === line) return;
			removeRoute(previous);
		}
		const cars = vehiclePoses(line, 0).map(() => new THREE.Mesh(geometries[line.kind], material));
		group.add(...cars);
		routes.set(line.id, { line, cars, startMs });
	}

	function setLines(lines: World['lines'], timeMs: number) {
		const ids = new Set(lines.map(({ id }) => id));
		for (const [id, route] of routes) if (!ids.has(id)) removeRoute(route);
		for (const line of lines) setLine(line, timeMs);
	}

	function step(timeMs: number) {
		for (const { line, cars, startMs } of routes.values()) {
			const poses = vehiclePoses(line, Math.max(0, timeMs - startMs) / 1000);
			poses.forEach(({ position: [x, y, z], headingRad, pitchRad }, index) => {
				const car = cars[index];
				car.position.set(x, z, -y);
				direction.set(
					Math.cos(headingRad) * Math.cos(pitchRad),
					Math.sin(pitchRad),
					-Math.sin(headingRad) * Math.cos(pitchRad)
				);
				car.quaternion.setFromUnitVectors(UP, direction);
			});
		}
		return routes.size > 0;
	}

	return {
		group,
		setLines,
		/** Updates car ink when the route changes epoch or focus. */
		setFocus(focus: FocusId, year: number) {
			for (const { line, cars } of routes.values()) {
				const level = levelFor(focus, 'rail', line.year, year);
				const inks = {
					full: material,
					silhouette: pencil,
					pencil,
					transparent: ghost,
					hidden: ghost
				};
				for (const car of cars) {
					car.visible = level !== 'hidden';
					car.material = inks[level];
				}
			}
		},
		step,
		/** Uses the current paper palette's people flow. */
		setPalette(palette: Palette3D) {
			ivory.value.set(palette.paper);
			livery.value.set(palette.categories[flowToken.people.slice('--cat-'.length)]);
			ghost.color.set(palette.ink);
			pencil.color.set(palette.paper).lerp(new THREE.Color(palette.ink), 0.45);
		},
		/** Releases the shared mesh resources. */
		dispose() {
			group.clear();
			for (const geometry of Object.values(geometries)) geometry.dispose();
			material.dispose();
			pencil.dispose();
			ghost.dispose();
		}
	};
}
