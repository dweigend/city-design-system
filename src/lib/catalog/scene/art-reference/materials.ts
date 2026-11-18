import * as T from 'three';

/** Allocate the materials shared by every fragment of one mounted plate. */
export function createPlateMaterials() {
	return {
		paper: new T.MeshBasicMaterial(),
		ink: new T.LineBasicMaterial(),
		soft: new T.LineBasicMaterial(),
		hatch: new T.LineBasicMaterial({ transparent: true, opacity: 0.48 }),
		glaze: new T.MeshStandardMaterial({ roughness: 0.56 }),
		water: new T.MeshStandardMaterial()
	};
}
export type PlateMaterials = ReturnType<typeof createPlateMaterials>;

/** Recolor the existing materials in place. Geometry and seed are independent of the palette. */
export function recolorPlate(
	materials: PlateMaterials,
	paper: string,
	ink: string,
	soft: string,
	water: string
) {
	materials.paper.color.set(paper);
	materials.ink.color.set(ink);
	materials.soft.color.set(soft);
	materials.hatch.color.copy(materials.soft.color);
	materials.glaze.color.copy(materials.paper.color).lerp(materials.soft.color, 0.35);
	materials.water.color.set(water);
}
