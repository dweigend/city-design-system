import { sandboxMotion } from '../../data/sandbox';
import { dropOffset } from '../../logic/formen';
import type { Primitive } from '../../logic/parametrik/types';

type Placement = { parts: Primitive[]; delayMs: number; durationMs: number };
const { pillarStepMs, responseMs, seatMs } = sandboxMotion;
const stagger = (index: number, step: number) => Math.min(index * step, responseMs - seatMs);

function railDelay(id: string) {
	const match = id.match(/\/(pillar|stop)\/(\d+)/);
	if (!match) return;
	return match[1] === 'stop' ? responseMs - seatMs : stagger(Number(match[2]), pillarStepMs);
}

function placementDelay(key: string, id: string, index: number): number | undefined {
	if (key.startsWith('line:')) return railDelay(id);
	return key.startsWith('forest:') ? stagger(index, 10) : 0;
}

function animateGroup(groups: Map<number, Placement>, delayMs: number, part: Primitive) {
	const group = groups.get(delayMs) ?? { parts: [], delayMs, durationMs: seatMs };
	group.parts.push(part);
	groups.set(delayMs, group);
}

/** Groups newly placed parts by their delay and leaves existing parts seated. */
export function placementGroups(key: string, parts: Primitive[], previous: Primitive[]) {
	const known = new Set(previous.map(({ id }) => id));
	const seated: Primitive[] = [];
	const groups = new Map<number, Placement>();
	for (const [index, part] of parts.entries()) {
		const delayMs = known.has(part.id) ? undefined : placementDelay(key, part.id, index);
		if (delayMs === undefined) seated.push(part);
		else animateGroup(groups, delayMs, part);
	}
	return { seated, groups: [...groups.values()] };
}

/** Scene offset in meters at a point in a placement's motion. */
export function placementOffset({ delayMs, durationMs }: Placement, elapsedMs: number) {
	return dropOffset(elapsedMs - delayMs, durationMs);
}
