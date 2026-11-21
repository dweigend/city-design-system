import type { StudioQuality } from '../studio-quality';
/** Owns the GPU objects for each key of the sandbox's derived structures. */
import * as THREE from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { createJointLayer } from './joint-layer';
import { kineticGroups } from './kinetic-groups';
import { stockPickTargets, structureBatch } from './structure-batch';
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
	cellId?: string;
	key: string;
	dockAt?: number;
	motion: ReturnType<typeof kineticGroups>['motion'];
};
type Moving = ReturnType<typeof placementGroups>['groups'][number] & {
	objects: Batch;
	startedMs: number;
	settled: boolean;
};
type Entry = { primitives: Primitive[]; objects: Batch; moving: Moving[]; cellId?: string };

export type Structures = ReturnType<typeof createStructures>;

/** Creates the structure layer. The caller adds the group to its scene and disposes it. */
export function createStructures(
	quality?: StudioQuality,
	cityEdges = false,
	receiverOutput?: Parameters<typeof structureMaterials>[2],
	markTerrainVolume?: (group: THREE.Object3D, wooded: boolean) => void
) {
	const group = new THREE.Group();
	const dot = new THREE.SphereGeometry(0.25, 12, 8);
	const finishes = structureMaterials(quality, cityEdges, receiverOutput);
	const joints = createJointLayer(finishes.materials.bearing, cityEdges);
	group.add(joints.group);
	const entries = new Map<string, Entry>();
	const pending = new Map<
		string,
		{ primitives: Primitive[]; cellId?: string; startedMs?: number }
	>();
	const animated = new Set<Entry>();
	const swept = new THREE.Box3();
	let shadowChanged = false;
	const hitLists = new Map<string, THREE.Object3D[]>();
	let distance: DrawingDistance = {
		screenEdges: cityEdges,
		scale: Infinity,
		minContourPx: 0,
		elevation: 0,
		block: false
	};

	function draw(
		key: string,
		primitives: Primitive[],
		cellId?: string,
		drawing = distanceDrawing(primitives, distance),
		dockAt?: number
	): Batch {
		const targets: THREE.Object3D[] = [];
		const { batches, motion } = kineticGroups(
			key,
			drawing.parts,
			(parts) => {
				const batch = structureBatch(parts, finishes, dot, { ...drawing, parts }, cellId);
				for (const target of batch.targets) {
					target.matrixWorldAutoUpdate = false;
					target.matrixWorld = batch.group.matrix;
				}
				targets.push(...batch.targets);
				return batch.group;
			},
			dockAt,
			drawing.details
		);
		const root =
			batches.length === 1 && !motion.active && dockAt === undefined
				? batches[0]
				: new THREE.Group();
		if (batches.length && root !== batches[0]) root.add(...batches);
		markTerrainVolume?.(root, key.startsWith('forest:'));
		return { group: root, targets, primitives, drawing, cellId, key, dockAt, motion };
	}

	function releaseObjects({ group: batch }: Batch) {
		group.remove(batch);
		batch.traverse((object) => {
			if (object instanceof THREE.InstancedMesh) object.dispose();
			else if (object instanceof THREE.Mesh) object.geometry.dispose();
		});
	}

	function track(entry: Entry) {
		if (entry.objects.motion.active || entry.moving.length) animated.add(entry);
		else animated.delete(entry);
	}

	function release(entry: Entry) {
		animated.delete(entry);
		releaseObjects(entry.objects);
		for (const { objects } of entry.moving) releaseObjects(objects);
	}

	function makeEntry(
		key: string,
		primitives: Primitive[],
		previous: Entry | undefined,
		cellId?: string,
		startedMs?: number
	): Entry {
		if (startedMs === undefined) {
			const drawing = distanceDrawing(primitives, distance, previous?.objects.drawing.contours);
			return { primitives, objects: draw(key, primitives, cellId, drawing), moving: [], cellId };
		}
		const { seated, groups } = placementGroups(key, primitives, previous?.primitives ?? []);
		const objects = draw(key, seated, cellId);
		const moving = groups.map((item) => ({
			...item,
			objects: draw(key, item.parts, cellId, undefined, (startedMs + item.delayMs) / 1000),
			startedMs,
			settled: false
		}));
		return { primitives, objects, moving, cellId };
	}

	/** Replaces one structure key, optionally seating its new parts from a clock time in ms. */
	function set(key: string, primitives: Primitive[], cellId?: string, startedMs?: number) {
		const previous = entries.get(key);
		if (previous?.primitives === primitives && previous.cellId === cellId) return;
		if (!key.startsWith('forest:')) joints.invalidate();
		hitLists.clear();
		if (previous) release(previous);
		entries.delete(key);
		if (!primitives.length) return;
		const entry = makeEntry(key, primitives, previous, cellId, startedMs);
		group.add(entry.objects.group, ...entry.moving.map((item) => item.objects.group));
		entries.set(key, entry);
		track(entry);
	}

	function redrawBatch(batch: Batch, recolor: boolean) {
		const drawing = distanceDrawing(batch.primitives, distance, batch.drawing.contours);
		if (!recolor && sameDrawing(batch.drawing, drawing)) return batch;
		const next = draw(batch.key, batch.primitives, batch.cellId, drawing, batch.dockAt);
		hitLists.clear();
		next.group.position.copy(batch.group.position);
		next.group.visible = batch.group.visible;
		group.add(next.group);
		releaseObjects(batch);
		return next;
	}

	function redraw(recolor: boolean) {
		for (const [key, entry] of entries) {
			if (pending.has(key)) continue;
			entry.objects = redrawBatch(entry.objects, recolor);
			for (const item of entry.moving) item.objects = redrawBatch(item.objects, recolor);
			track(entry);
		}
	}

	/** Removes every key. */
	function clear() {
		pending.clear();
		joints.clear();
		for (const key of [...entries.keys()]) set(key, []);
	}

	function place(item: Moving, timeMs: number, reduced: boolean) {
		const elapsed = reduced ? item.delayMs + item.durationMs : timeMs - item.startedMs;
		const offset = placementOffset(item, elapsed);
		item.objects.group.position.y = offset;
		item.objects.group.visible = elapsed >= item.delayMs;
		return offset > 0;
	}

	function* seatedParts() {
		for (const [key, entry] of entries) {
			if (key.startsWith('forest:')) continue;
			yield { key, parts: entry.objects.primitives };
			for (const item of entry.moving) if (item.settled) yield { key, parts: item.parts };
		}
	}

	function updateJointSeating(item: Moving) {
		const root = item.objects.group;
		const settled =
			root.visible &&
			root.position.y === 0 &&
			root.children.every((child) => child.rotation.z === 0);
		if (settled !== item.settled) joints.invalidate();
		item.settled = settled;
	}

	return {
		group,
		stockTargets: (parts: Primitive[]) => stockPickTargets(parts, finishes),
		set,
		/** Coalesces geometry changes until the camera and drawing style are ready. */
		queue(this: void, key: string, primitives: Primitive[], cellId?: string, startedMs?: number) {
			const previous = entries.get(key);
			if (
				!primitives.length ||
				(previous?.primitives === primitives && previous.cellId === cellId)
			) {
				pending.delete(key);
				if (!primitives.length) set(key, []);
				return;
			}
			const prior = pending.get(key);
			pending.set(key, { primitives, cellId, startedMs: startedMs ?? prior?.startedMs });
		},
		clear,
		setJointView: joints.setView.bind(joints),
		swept,
		get shadowChanged() {
			return shadowChanged;
		},
		/** Samples the seated drop and the inner pose at a single timeline coordinate. */
		step(timeMs: number, reduced: boolean) {
			const seconds = timeMs / 1000;
			finishes.seconds.value = seconds;
			swept.makeEmpty();
			shadowChanged = false;
			let changed = false;
			const sample = ({ motion }: Batch) => {
				if (!motion.active || !motion.sample(seconds)) return;
				changed = true;
				swept.union(motion.swept);
				shadowChanged ||= motion.casts;
			};
			for (const { objects, moving } of animated) {
				sample(objects);
				for (const item of moving) {
					const y = item.objects.group.position.y;
					const shown = item.objects.group.visible;
					changed = place(item, timeMs, reduced) || changed;
					shadowChanged ||=
						y !== item.objects.group.position.y || shown !== item.objects.group.visible;
					sample(item.objects);
					if (!objects.key.startsWith('forest:')) updateJointSeating(item);
				}
			}
			joints.draw(seatedParts);
			return changed;
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
				distance = { screenEdges: cityEdges, scale, elevation, block, minContourPx };
				redraw(recolor);
			}
			for (const [key, { primitives, cellId, startedMs }] of pending)
				set(key, primitives, cellId, startedMs);
			pending.clear();
		},
		/** Updates sandbox-only material settings in schema units. */
		setParams: finishes.setParams.bind(finishes),
		setPalette: finishes.explicit.setPalette.bind(finishes.explicit),
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
