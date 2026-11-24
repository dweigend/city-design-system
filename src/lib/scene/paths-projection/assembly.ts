import type { Vec3 } from '../../core/geometry';
import { PlaceableObject, type Anchor } from '../../core/object';
import { resolveSurfaces, type Surface } from '../surface';
import { mesh } from './mesh';
import type { PathsFrame } from './types';

// Exact arithmetic: the outward normal points up in the Z-up frame.
export const up: Vec3 = [0, 0, 1];

// Exact arithmetic: one placeholder triangle is three XYZ positions.
function strokePlaceholder(positions: readonly number[]) {
	return {
		kind: 'mesh' as const,
		positions: positions.slice(0, 6).concat(positions.slice(0, 3)),
		indices: [0, 1, 2]
	};
}

type Layer = { body: ReturnType<typeof mesh>; stroke: number[]; surface: Surface };

export function assembly(id: string, frame: PathsFrame) {
	const layers = new Map<string, Layer>();
	return {
		layer(name: string, surface: Surface) {
			const layer = { body: mesh(), stroke: [], surface };
			layers.set(name, layer);
			return layer;
		},
		complete(anchors: readonly Anchor[] = []) {
			const slots = [...layers.keys()];
			const parts = [...layers].flatMap(([slot, { body, stroke }]) => {
				const shape = body.shape();
				if (shape) return [{ id: slot, slot, shape }];
				if (!stroke.length) return [];
				// A stroke-only drawable carries an unseen placeholder triangle.
				return [{ id: slot, slot, shape: strokePlaceholder(stroke) }];
			});
			const object = PlaceableObject.create({
				id,
				slots,
				parts,
				footprint: frame.footprint,
				anchors
			});
			const drawables = resolveSurfaces(
				object,
				Object.fromEntries([...layers].map(([slot, layer]) => [slot, layer.surface]))
			).map((part) => {
				const layer = layers.get(part.id);
				return {
					...part,
					fillVisible: Boolean(layer?.body.shape()),
					...(layer?.stroke.length ? { strokeSegments: layer.stroke } : {})
				};
			});
			return { object, drawables };
		}
	};
}

export function local(frame: PathsFrame, [x, y, z]: Vec3): Vec3 {
	return [...frame.toLocal(x, y), z];
}

export function trace(target: number[], points: readonly Vec3[], liftM: number) {
	for (let i = 1; i < points.length; i++) {
		const [x, y, z] = points[i - 1];
		const [a, b, c] = points[i];
		target.push(x, y, z + liftM, a, b, c + liftM);
	}
}
