import { materialSettings } from '../../../config/material';
import { dotProduct, type Vec2, type Vec3 } from '../../core/geometry';
import { clipToOutline, cutOpenings } from './cells';
import type { Frame } from './patch';
import { addCell, type MeshSink, type Unit } from './prism';

const { planeToleranceM, shadeLiftM } = materialSettings;

/** The hard shade a level unit casts onto its `castOnto` plane: its outline moved along the
 * light, minus the unit's own bounding rectangle, lifted just above the plane it falls on. */
export function addShade(sink: MeshSink, frame: Frame, unit: Unit, light: Vec3) {
	const { polygon, base, top, castOnto = base } = unit;
	const facing = dotProduct(light, frame.patch.normal);
	const rise = top.at - castOnto;
	if (top.perU || top.perV || facing >= 0 || rise <= planeToleranceM) return;
	const reach = -rise / facing;
	const [du, dv] = [
		reach * dotProduct(light, frame.patch.across),
		reach * dotProduct(light, frame.up)
	];
	const clipped = clipToOutline(polygon, frame.outline);
	if (!clipped.length) return;
	const us = clipped.map(([u]) => u);
	const vs = clipped.map(([, v]) => v);
	const own = [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)] as const;
	const moved = clipToOutline(
		clipped.map(([u, v]): Vec2 => [u + du, v + dv]),
		frame.outline
	);
	if (!moved.length) return;
	const at = castOnto + shadeLiftM;
	for (const cell of cutOpenings(moved, [own, ...(frame.patch.openings ?? [])]))
		addCell(sink, frame, cell, at, { at }, false);
}

/** Shade that another body casts onto the patch: on the backing between units and on every
 * level unit top it covers. */
export function addCastShadow(
	sinks: Readonly<Record<'joint' | 'unit', MeshSink>>,
	frame: Frame,
	shadow: readonly Vec2[],
	units: readonly Unit[]
) {
	const openings = frame.patch.openings ?? [];
	const place = (polygon: readonly Vec2[], at: number, sink: MeshSink) => {
		const clipped = clipToOutline(clipToOutline(polygon, frame.outline), shadow);
		if (!clipped.length) return;
		for (const cell of cutOpenings(clipped, openings))
			addCell(sink, frame, cell, at, { at }, false);
	};
	place(frame.outline, shadeLiftM, sinks.joint);
	for (const { polygon, top } of units)
		if (!top.perU && !top.perV) place(polygon, top.at + shadeLiftM, sinks.unit);
}
