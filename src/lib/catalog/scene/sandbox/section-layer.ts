import * as THREE from 'three/webgpu';
import { sectionThrough } from '../../logic/view-modes';
import type { Palette3D } from '../../data/city3d';
import type { Vec3 } from '../../logic/parametrik/types';
import { polylineObject } from './polylines';
import { sectionFill, sectionSegments } from './section-profile';

export type SectionFrame = Readonly<{
	bounds: THREE.Box3;
	heading: number;
}>;

const toWorld = ({ x, y, z }: THREE.Vector3): Vec3 => [x, -z, y];

type ProfileSource = {
	parent: THREE.Object3D;
	ground: readonly THREE.BufferGeometry[];
	baseM: number;
	waterM?: number;
};

function cutWater(slices: ReturnType<typeof sectionSegments>, level: number) {
	const positions: number[] = [];
	for (const [a, b] of slices) {
		if (Math.min(a.y, b.y) >= level) continue;
		const left = a.clone();
		const right = b.clone();
		if (left.y > level) left.lerp(b, (level - a.y) / (b.y - a.y));
		if (right.y > level) right.lerp(a, (level - b.y) / (a.y - b.y));
		const topLeft = left.clone().setY(level);
		const topRight = right.clone().setY(level);
		for (const point of [topLeft, topRight, right, topLeft, right, left])
			positions.push(point.x, point.y, point.z);
	}
	return new THREE.BufferGeometry().setAttribute(
		'position',
		new THREE.Float32BufferAttribute(positions, 3)
	);
}

/** Owns the retained section fill, profile and its matching plan marker. */
export function createSectionLayer() {
	const group = new THREE.Group();
	const marker = new THREE.Group();
	const paper = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
	const water = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
	const stroke = new THREE.Line2NodeMaterial({
		linewidth: 2.2,
		depthTest: false,
		depthWrite: false
	});
	const dash = new THREE.Line2NodeMaterial({
		linewidth: 1.6,
		dashed: true,
		depthTest: false,
		depthWrite: false,
		dashSize: 2,
		gapSize: 1.3
	});
	const resources: THREE.BufferGeometry[] = [];
	const profiles: THREE.Group[] = [];
	const plane = new THREE.Plane();
	let anchors: readonly [Vec3, Vec3] | undefined;
	let frame: SectionFrame | undefined;
	const targets: THREE.Mesh[] = [];

	function clear() {
		for (const profile of profiles) profile.removeFromParent();
		for (const geometry of resources) geometry.dispose();
		resources.length = profiles.length = targets.length = 0;
		marker.clear();
	}

	function buildProfile({ parent, ground, baseM, waterM }: ProfileSource) {
		const slices = ground.flatMap((geometry) => sectionSegments(geometry, plane));
		const profile = new THREE.Group();
		const geometry = sectionFill(slices, baseM);
		const fill = new THREE.Mesh(geometry, paper);
		resources.push(geometry);
		targets.push(fill);
		profile.add(fill);
		if (waterM !== undefined) {
			const wet = cutWater(slices, waterM);
			const face = new THREE.Mesh(wet, water);
			face.position.addScaledVector(plane.normal, -0.01);
			profile.add(face);
			resources.push(wet);
		}
		const outline = polylineObject(
			slices.map(([a, b]) => [toWorld(a), toWorld(b)]),
			stroke
		);
		if (outline) {
			outline.renderOrder = 5;
			profile.add(outline);
			resources.push(outline.geometry);
		}
		// Keep coplanar faces on the visible side of raster clipping.
		profile.position.addScaledVector(plane.normal, 0.015);
		parent.add(profile);
		profiles.push(profile);
	}

	/** Rebuilds the analytical layers on world change, independently of view switches. */
	function rebuild(
		center: Vec3,
		normal: readonly [number, number],
		reachM: number,
		vertical: readonly [number, number],
		sources: readonly ProfileSource[]
	) {
		clear();
		const descriptor = sectionThrough(center, normal);
		const [nx, ny] = descriptor.normal;
		plane.setComponents(-nx, 0, ny, descriptor.offsetM);
		for (const source of sources) buildProfile(source);
		const [x, y] = center;
		const [bottom, top] = vertical;
		const end = (distance: number, z: number): Vec3 => [x - ny * distance, y + nx * distance, z];
		anchors = [end(-reachM, top + 1), end(reachM, top + 1)];
		const bounds = new THREE.Box3().setFromPoints([
			new THREE.Vector3(...toThree(end(-reachM, bottom))),
			new THREE.Vector3(...toThree(end(reachM, top)))
		]);
		frame = { bounds, heading: Math.atan2(nx, -ny) };
		const line = polylineObject([anchors], dash);
		if (line) {
			line.computeLineDistances();
			line.renderOrder = 25;
			marker.add(line);
			resources.push(line.geometry);
		}
	}

	return {
		group,
		marker,
		plane,
		targets,
		rebuild,
		get frame() {
			return frame;
		},
		get anchors() {
			return anchors;
		},
		/** Updates the section's earth, water and drafting inks from the current scene palette. */
		setPalette(palette: Palette3D, waterColor: THREE.Color) {
			paper.color
				.set(palette.paper)
				.lerp(new THREE.Color(palette.terrainSoil ?? palette.ink), 0.22);
			water.color.copy(waterColor);
			stroke.color.set(palette.ink);
			dash.color.set(palette.ink);
		},
		/** Toggles the retained cut faces and the plan trace. */
		setVisibility(section: boolean, plan: boolean) {
			group.visible = section;
			for (const profile of profiles) profile.visible = section;
			marker.visible = plan;
		},
		/** Releases retained section buffers and materials. */
		dispose() {
			clear();
			for (const material of [paper, water, stroke, dash]) material.dispose();
		}
	};
}

const toThree = ([x, y, z]: Vec3) => [x, z, -y] as const;
