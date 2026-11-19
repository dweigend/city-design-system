import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { deriveStructuralJoints, sandboxStructuralContacts } from '../../logic/structural-joints';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { StructureMaterials } from './structure-materials';
import { jointMesh } from './structure-parts';

/** Holds the single ink mesh for the seated contacts, rebuilding only when the inputs change. */
export function createJointLayer(material: StructureMaterials['materials']['bearing']) {
	const group = new Group();
	let mesh: ReturnType<typeof jointMesh>;
	let dirty = true;
	let grid: TerrainGrid | undefined;
	let built = 0;
	let close = false;

	function clear() {
		if (mesh) {
			group.remove(mesh);
			mesh.geometry.dispose();
			mesh = undefined;
		}
		dirty = true;
	}

	return {
		group,
		clear,
		/** Updates the terrain, date and zoom used for the next contact survey. */
		setView(nextGrid: TerrainGrid, year: number, details: boolean) {
			dirty ||= nextGrid !== grid || year !== built;
			grid = nextGrid;
			built = year;
			close = details;
			group.visible = close;
		},
		/** Invalidates the contact graph after a change to its seated geometry. */
		invalidate() {
			dirty = true;
		},
		/** Rebuilds the visible connector geometry from the current structure batches. */
		draw(batches: () => Iterable<{ key: string; parts: readonly Primitive[] }>) {
			if (!grid || !close || !dirty) return;
			const joints = deriveStructuralJoints(sandboxStructuralContacts(batches(), grid, built));
			clear();
			mesh = jointMesh(joints, material);
			if (mesh) group.add(mesh);
			dirty = false;
		}
	};
}
