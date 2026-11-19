import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { dockPose } from './docking';

import { poseSampler, type Pose } from './pose-sampler';

/** One wind field per spatial batch. A small rotation about the patch centre gives
 * adjacent crowns distinct trajectories without deforming their geometry. */
function canopyPose(crowns: Primitive[], strength: number): Pose | undefined {
	const points = crowns.flatMap((p) => ('position' in p ? [p.position] : []));
	if (!points.length) return;
	const [cx, cz] = points.reduce(
		([x, z], p) => [x + p[0] / points.length, z - p[1] / points.length],
		[0, 0]
	);
	const reach = points.reduce((r, p) => Math.max(r, Math.hypot(p[0] - cx, p[1] + cz)), 1);
	const phase = cx * 0.11 - cz * 0.07;
	return (group, s) => {
		const gust = Math.sin(s * 1.7 + phase) + 0.35 * Math.sin(s * 3.1 + phase * 0.7);
		const angle = (strength / reach) * 0.35 * Math.cos(s * 1.7 + phase);
		const c = Math.cos(angle),
			sin = Math.sin(angle);
		group.rotation.y = angle;
		group.position.set(
			strength * gust + cx * (1 - c) - cz * sin,
			-strength * 0.1 * gust * gust,
			(strength * gust) / 3 + cz * (1 - c) + cx * sin
		);
	};
}

function splitDocked(
	parts: Primitive[],
	at: number,
	add: (parts: Primitive[], pose?: Pose) => void
) {
	const remaining = new Set(parts);
	for (const capsule of parts) {
		if (capsule.kind !== 'capsule') continue;
		const selected = parts.filter((p) => p === capsule || p.id.startsWith(capsule.id + '/'));
		for (const part of selected) remaining.delete(part);
		add(selected, (group, s) => dockPose(group, capsule, s - at));
	}
	add([...remaining]);
}

/** Splits a district into rigid and moving draws. Its sampler also updates the matrix
 * shared by the detached pick targets, independently of the enclosing placement drop. */
export function kineticGroups(
	key: string,
	parts: Primitive[],
	build: (parts: Primitive[]) => Group,
	placedAt?: number,
	wind = true
) {
	const batches: Group[] = [];
	const motion = poseSampler();
	const add = (selected: Primitive[], pose?: Pose) => {
		if (!selected.length) return;
		const group = build(selected);
		batches.push(group);
		if (pose) motion.add(group, pose);
	};
	const forest = key.startsWith('forest:');
	const isCrown = (p: Primitive) =>
		forest
			? !p.id.includes(':trunk')
			: p.kind === 'sphere' && p.role === 'neu' && /:fruit\d+$/.test(p.id);
	const crowns = wind ? parts.filter(isCrown) : [];
	const rigid = crowns.length ? parts.filter((p) => !isCrown(p)) : parts;
	if (placedAt === undefined || forest) add(rigid);
	else splitDocked(rigid, placedAt, add);
	add(crowns, canopyPose(crowns, forest ? 0.12 : 0.045));
	return { batches, motion };
}
