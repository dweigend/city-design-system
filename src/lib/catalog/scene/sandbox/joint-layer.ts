import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { deriveStructuralJoints, sandboxStructuralContacts } from '../../logic/structural-joints';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { StructureMaterials } from './structure-materials';
import { wallContact } from './wall-contact';
import { stairSeats } from './stair-seats';
import { contactWash } from './contact-wash';
import { jointMesh } from './structure-parts';

/** Holds the single ink mesh for the seated contacts, rebuilding only when the inputs change. */
export function createJointLayer(
	material: StructureMaterials['materials']['bearing'],
	drawContacts = false
) {
	const group = new Group();
	let mesh: ReturnType<typeof jointMesh>;
	let seams: ReturnType<typeof wallContact>;
	let wash: ReturnType<typeof contactWash>;
	let dirty = true;
	let grid: TerrainGrid | undefined;
	let built = 0;
	let close = false;

	function clear() {
		if (seams) {
			group.remove(seams);
			seams.geometry.dispose();
			seams.material.dispose();
			seams = undefined;
		}
		if (wash) {
			group.remove(wash);
			wash.material.dispose();
			wash.geometry.dispose();
			wash.dispose();
			wash = undefined;
		}
		if (mesh) {
			group.remove(mesh);
			mesh.geometry.dispose();
			mesh = undefined;
		}
		dirty = true;
	}

	function drawWash(
		seated: { parts: readonly Primitive[] }[],
		contacts: ReturnType<typeof sandboxStructuralContacts>,
		grid: TerrainGrid
	) {
		seams = wallContact(
			seated.flatMap((b) => b.parts),
			grid
		);
		if (seams) group.add(seams);
		const seats = contacts
			.filter((c) => c.supportNormal || c.seat === 'slab-seam')
			.map((c) => ({
				point: c.point,
				normal: c.supportNormal ?? c.axis,
				diameter: c.member.diameter
			}));
		for (const batch of seated) seats.push(...stairSeats(batch.parts, grid));
		wash = contactWash(seats);
	}

	return {
		group,
		clear,
		/** Updates the terrain, date and zoom used for the next contact survey. */
		setView(nextGrid: TerrainGrid, year: number, details: boolean) {
			dirty ||= nextGrid !== grid || year !== built || details !== close;
			grid = nextGrid;
			built = year;
			close = details;
			group.visible = close || drawContacts;
		},
		/** Invalidates the contact graph after a change to its seated geometry. */
		invalidate() {
			dirty = true;
		},
		/** Rebuilds the visible connector geometry from the current structure batches. */
		draw(batches: () => Iterable<{ key: string; parts: readonly Primitive[] }>) {
			if (!grid || !group.visible || !dirty) return;
			const seated = [...batches()];
			const contacts = sandboxStructuralContacts(seated, grid, built);
			clear();
			if (drawContacts) drawWash(seated, contacts, grid);
			if (wash) group.add(wash);
			mesh = close ? jointMesh(deriveStructuralJoints(contacts), material) : undefined;
			if (mesh) group.add(mesh);
			dirty = false;
		}
	};
}
