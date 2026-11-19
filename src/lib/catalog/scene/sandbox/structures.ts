/** Owns the GPU objects for each key of the sandbox's derived structures. */
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { structureBatch } from './structure-batch';
import { structureMaterials } from './structure-materials';
import { placementGroups, placementOffset } from './placement-motion';
import {
	distanceDrawing,
	sameDrawing,
	type DistanceDrawing,
	type DrawingDistance
} from './distance-drawing';

type Batch = ReturnType<typeof structureBatch> & {
	primitives: Primitive[];
	drawing: DistanceDrawing;
};
type Moving = ReturnType<typeof placementGroups>['groups'][number] & {
	objects: Batch;
	startedMs: number;
};
type Entry = { primitives: Primitive[]; objects: Batch; moving: Moving[] };

export type Structures = ReturnType<typeof createStructures>;

/** Creates the structure layer. The caller adds the group to its scene and disposes it. */
export function createStructures() {
	const group = new THREE.Group();
	const dot = new THREE.SphereGeometry(0.25, 12, 8);
	const finishes = structureMaterials();
	const entries = new Map<string, Entry>();
	const hitLists = new Map<string, THREE.Object3D[]>();
	let distance: DrawingDistance = { scale: Infinity, minContourPx: 0, elevation: 0, block: false };

	function draw(primitives: Primitive[], drawing = distanceDrawing(primitives, distance)): Batch {
		return { ...structureBatch(primitives, finishes, dot, drawing), primitives, drawing };
	}

	function releaseObjects({ group: batch }: Batch) {
		group.remove(batch);
		for (const object of batch.children) {
			if (object instanceof THREE.InstancedMesh) object.dispose();
			else if (object instanceof THREE.Mesh) object.geometry.dispose();
		}
	}

	function release(entry: Entry) {
		releaseObjects(entry.objects);
		for (const { objects } of entry.moving) releaseObjects(objects);
	}

	function makeEntry(
		key: string,
		primitives: Primitive[],
		previous: Entry | undefined,
		startedMs?: number
	): Entry {
		if (startedMs === undefined)
			return { primitives, objects: draw(primitives), moving: [] };
		const { seated, groups } = placementGroups(key, primitives, previous?.primitives ?? []);
		const objects = draw(seated);
		const moving = groups.map((item) => ({
			...item,
			objects: draw(item.parts),
			startedMs
		}));
		return { primitives, objects, moving };
	}

	/** Replaces one structure key, optionally seating its new parts from a clock time in ms. */
	function set(key: string, primitives: Primitive[], startedMs?: number) {
		const previous = entries.get(key);
		hitLists.clear();
		if (previous) release(previous);
		entries.delete(key);
		if (!primitives.length) return;
		const entry = makeEntry(key, primitives, previous, startedMs);
		group.add(entry.objects.group, ...entry.moving.map((item) => item.objects.group));
		entries.set(key, entry);
	}

	function redrawBatch(batch: Batch, recolor: boolean) {
		const drawing = distanceDrawing(batch.primitives, distance);
		if (!recolor && sameDrawing(batch.drawing, drawing)) return batch;
		const next = draw(batch.primitives, drawing);
		hitLists.clear();
		next.group.position.copy(batch.group.position);
		next.group.visible = batch.group.visible;
		group.add(next.group);
		releaseObjects(batch);
		return next;
	}

	function redraw(recolor: boolean) {
		for (const entry of entries.values()) {
			entry.objects = redrawBatch(entry.objects, recolor);
			for (const item of entry.moving) item.objects = redrawBatch(item.objects, recolor);
		}
	}

	/** Removes every key. */
	function clear() {
		for (const key of [...entries.keys()]) set(key, []);
	}

	function place(item: Moving, timeMs: number, reduced: boolean) {
		if (reduced) item.startedMs = Math.min(item.startedMs, timeMs - item.delayMs - item.durationMs);
		const elapsed = timeMs - item.startedMs;
		const offset = placementOffset(item, elapsed);
		item.objects.group.position.y = offset;
		item.objects.group.visible = elapsed >= item.delayMs;
		return offset > 0;
	}

	return {
		group,
		set,
		clear,
		/** Updates pending drop offsets and reports whether another frame is needed. */
		step(timeMs: number, reduced: boolean) {
			let active = false;
			for (const { moving } of entries.values())
				for (const item of moving) active = place(item, timeMs, reduced) || active;
			return active;
		},
		/** Updates material roles at the current zoom. Theme changes also re-bake vertex colors. */
		setStyle(args: Parameters<typeof finishes.setStyle>, elevation: number) {
			const [style, , scale] = args;
			const block = style.rollen.weg.level === 'block';
			const minContourPx = finishes.minContourPx();
			const recolor = finishes.setStyle(...args);
			if (
				recolor ||
				scale !== distance.scale ||
				elevation !== distance.elevation ||
				block !== distance.block ||
				minContourPx !== distance.minContourPx
			) {
				distance = { scale, elevation, block, minContourPx };
				redraw(recolor);
			}
		},
		/** Updates sandbox-only material settings in schema units. */
		setParams: finishes.setParams,
		/** Detached ray targets for the structure keys with the given prefix. */
		solids(prefix: string): THREE.Object3D[] {
			const cached = hitLists.get(prefix);
			if (cached) return cached;
			const targets = [...entries]
				.filter(([key]) => key.startsWith(prefix))
				.flatMap(([, entry]) => [
					...entry.objects.targets,
					...entry.moving.flatMap((item) => item.objects.targets)
				]);
			hitLists.set(prefix, targets);
			return targets;
		},
		/** Releases all geometry and materials. */
		dispose() {
			clear();
			dot.dispose();
			finishes.dispose();
		}
	};
}
