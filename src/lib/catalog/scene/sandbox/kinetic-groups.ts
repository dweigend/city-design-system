import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';

type Build = (parts: Primitive[]) => Group;
type Motion = (seconds: number) => void;

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
		if (move) updates.push((seconds) => move(batch, seconds));
	}
	if (key.startsWith('forest:')) {
		const crowns = parts.filter((p) => !p.id.includes(':trunk'));
		const canopy = new Set(crowns);
		add(parts.filter((p) => !canopy.has(p)));
		const first = crowns.find((p) => 'position' in p);
		const phase =
			first && 'position' in first ? first.position[0] * 0.11 + first.position[1] * 0.07 : 0;
		add(crowns, (g, s) => {
			const gust = Math.sin(s * 1.7 + phase) + 0.35 * Math.sin(s * 3.1 + phase * 0.7);
			g.position.set(0.12 * gust, -0.012 * gust * gust, 0.04 * gust);
		});
	} else if (placedAt !== undefined) {
		const known = new Set(previous.map((p) => p.id));
		const fresh = new Set(parts.filter((p) => p.role !== 'bestand' && !known.has(p.id)));
		add(parts.filter((p) => !fresh.has(p)));
		add([...fresh], (g, s) => {
			// Gravity drop from 28 cm, then one damped elastic contact with the socket.
			const t = Math.max(0, s - placedAt);
			const impact = Math.sqrt(0.56 / 9.81);
			const rebound = Math.max(0, t - impact);
			g.position.y =
				t < impact
					? 0.28 - 4.905 * t * t
					: 0.038 * Math.exp(-24 * rebound) * Math.abs(Math.sin(34 * rebound));
		});
	} else add(parts);
	return { batches, updates };
}
