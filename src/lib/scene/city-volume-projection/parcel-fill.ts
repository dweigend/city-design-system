import { booleanOpDWithPolyTree, ClipType, FillRule, PolyTreeD, type PolyPathD } from 'clipper2-ts';
import { ShapeUtils, Vector2 } from 'three/webgpu';
import type { Vec2 } from '../../core/geometry';
import type { PlanPolygon } from '../../domain/parcels';
import type { createTerrainDrape } from '../terrain-grid-projection';
import { overlayClipPrecisionDigits } from './constants';
import type { mesh } from './mesh';

export function appendParcelFill(
	shape: ReturnType<typeof mesh>,
	polygon: PlanPolygon,
	liftM: number,
	toLocal: (x: number, y: number) => Vec2,
	project: ReturnType<typeof createTerrainDrape>
) {
	const local = polygon.map((ring) => ring.map(([x, y]) => toLocal(x, y)));
	const subject = local.map((ring) => ring.map(([x, y]) => ({ x, y })));
	for (const facet of project.facets(local[0])) {
		const result = new PolyTreeD();
		const clip = facet.map(([x, y]) => ({ x, y }));
		booleanOpDWithPolyTree(
			ClipType.Intersection,
			subject,
			[clip],
			result,
			FillRule.NonZero,
			overlayClipPrecisionDigits
		);
		const outline = (node: PolyPathD) => (node.poly ?? []).map(({ x, y }) => new Vector2(x, y));

		function append(parent: PolyPathD) {
			for (let i = 0; i < parent.count; i++) {
				const outer = parent.child(i);
				const children = Array.from({ length: outer.count }, (_, j) => outer.child(j));
				const contour = outline(outer);
				const holes = children.map(outline);
				const triangles = ShapeUtils.triangulateShape(contour, holes);
				const offset = shape.positions.length / 3;
				for (const { x, y } of [contour, ...holes].flat())
					shape.positions.push(x, y, project.heightOnFacet([x, y], facet) + liftM);
				for (const [a, b, c] of triangles) shape.indices.push(offset + a, offset + b, offset + c);
				for (const hole of children) append(hole);
			}
		}
		append(result);
	}
}
