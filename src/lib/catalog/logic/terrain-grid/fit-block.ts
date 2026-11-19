import { kern } from '../parametrik/raster/universal';
import { required } from '../required';
import type { blockTemplate } from './block-faces';
import { cellId } from './types';

type Template = ReturnType<typeof blockTemplate>;

/** Repair only rejected source groups inside the patch. Return undefined when its fixed rim needs a regular interior. */
export function fitBlocks(
	template: Template,
	positions: Map<string, kern.Vec>,
	minArea: number,
	regular: () => Template,
	projectVertex: (p: kern.Vec) => kern.Vec
) {
	const limits = { ...kern.defaultLimits, minArea };
	const groups = new Set<string>();
	for (const [id, face] of template.faces) {
		const points = face.ring.map((v) => required(positions.get(v), 'projected corner'));
		if (!kern.acceptable(kern.quadQuality(points), limits))
			groups.add(required(template.parents.get(id), 'block').group);
	}
	if (!groups.size) return template;
	// A concave source can cross the two proposal groups that supplied its ears.
	const affectedParents = new Set(
		[...template.parents.values()].filter((p) => groups.has(p.group)).map((p) => p.id)
	);
	for (const parent of template.parents.values())
		if (affectedParents.has(parent.id)) groups.add(parent.group);
	const fallback = regular(),
		faces = new Map(template.faces),
		parents = new Map(template.parents);
	for (const [id, block] of fallback.parents) {
		if (!groups.has(block.group)) continue;
		const face = required(fallback.faces.get(id), 'replacement parcel');
		parents.set(id, block);
		faces.set(id, face);
		for (const v of face.ring)
			positions.set(v, projectVertex(required(fallback.positions.get(v), 'replacement corner')));
	}
	if (!repairCenters(faces, parents, groups, positions, limits)) return undefined;
	return { ...template, faces, parents };
}

function repairCenters(
	faces: Template['faces'],
	parents: Template['parents'],
	groups: Set<string>,
	positions: Map<string, kern.Vec>,
	limits: kern.Limits
) {
	const blocks = new Set([...parents.values()].filter((p) => groups.has(p.group)).map((p) => p.id));
	for (const id of blocks) {
		const [x, y] = id.split('/').map(Number),
			center = cellId(x + 1, y + 1);
		const children = [...faces.values()].filter((f) => parents.get(f.id)?.id === id);
		const corners = [
			[x, y],
			[x + 2, y],
			[x + 2, y + 2],
			[x, y + 2]
		].map(([c, r]) => required(positions.get(cellId(c, r)), 'block boundary'));
		const original = required(positions.get(center), 'block center');
		const attempts = corners
			.flatMap((corner, i) => [corner, kern.mix(corner, corners[(i + 1) % 4], 0.5)])
			.flatMap((p) => [1 / 32, 1 / 16, 1 / 8, 1 / 4].map((share) => kern.mix(original, p, share)));
		if (
			!kern.fitQuadCenter(positions, center, children, corners, limits, [
				original,
				...attempts,
				original
			])
		)
			return false;
	}
	return true;
}
