import { dockPose, seatingLift } from './docking';
import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';

type Build = (parts: Primitive[]) => Group;
type Motion = (seconds: number) => boolean;

/** Builds separately moving crown and placement batches, retaining their actual ray targets. */
export function kineticGroups(
	key: string,
	parts: Primitive[],
	previous: Primitive[],
	build: Build,
	placedAt?: number
) {
	const batches: Group[] = [];
	const updates: Motion[] = [];
	function add(selected: Primitive[], move?: (group: Group, seconds: number) => void) {
		if (!selected.length) return;
		const batch = build(selected);
		batches.push(batch);
		if (move)
			updates.push((seconds) => {
				const { x, y, z } = batch.position;
				move(batch, seconds);
				return x !== batch.position.x || y !== batch.position.y || z !== batch.position.z;
			});
	}
	const forest = key.startsWith('forest:');
	const crowns = parts.filter((p) =>
		forest
			? !p.id.includes(':trunk')
			: p.kind === 'sphere' && p.role === 'neu' && /:fruit\d+$/.test(p.id)
	);
	const canopy = new Set(crowns);
	const rigid = crowns.length ? parts.filter((p) => !canopy.has(p)) : parts;
	if (forest || placedAt === undefined) add(rigid);
	else {
		const known = new Set(previous.map((p) => p.id));
		const fresh = new Set(rigid.filter((p) => p.role !== 'bestand' && !known.has(p.id)));
		add(rigid.filter((p) => !fresh.has(p)));
		for (const capsule of [...fresh]) {
			if (capsule.kind !== 'capsule') continue;
			const companions = [...fresh].filter(
				(p) => p === capsule || p.id.startsWith(capsule.id + '/')
			);
			for (const part of companions) fresh.delete(part);
			add(companions, (g, s) => dockPose(g, capsule, s - placedAt));
		}
		add([...fresh], (g, s) => {
			g.position.y = seatingLift(s - placedAt);
		});
	}
	const first = crowns.find((p) => 'position' in p);
	if (first && 'position' in first) {
		const phase = first.position[0] * 0.11 + first.position[1] * 0.07;
		const strength = forest ? 0.12 : 0.045;
		add(crowns, (g, s) => {
			const gust = Math.sin(s * 1.7 + phase) + 0.35 * Math.sin(s * 3.1 + phase * 0.7);
			g.position.set(strength * gust, -strength * 0.1 * gust * gust, (strength * gust) / 3);
		});
	} else add(crowns);
	return { batches, updates };
}
