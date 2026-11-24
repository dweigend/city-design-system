import type { Vec2, Vec3 } from '../../core/geometry';
import type { ParcelLane, ParcelPortal } from '../../domain/parcels';
import type { MovementNode } from '../../domain/movement-network';
import { defaults } from '../../../config/city-movement';
import type { CitySite } from '../city-site';
import { link, type Link } from './links';

export function drape(a: Vec3, b: Vec3, site: CitySite): Vec3[] {
	const count = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / defaults.groundTraceStepM);
	return Array.from({ length: Math.max(0, count - 1) }, (_, i) => {
		const t = (i + 1) / count;
		const x = a[0] + (b[0] - a[0]) * t;
		const y = a[1] + (b[1] - a[1]) * t;
		return [x, y, site.sampleGround(x, y).height];
	});
}

function frontageMidpoint({ points: [[x, y], [u, v]] }: ParcelPortal): Vec2 {
	return [(x + u) / 2, (y + v) / 2];
}

function laneParameter([x, y]: Vec2, { points: [[ax, ay], [bx, by]] }: ParcelLane) {
	const dx = bx - ax;
	const dy = by - ay;
	return Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
}

export function connectLane(
	site: CitySite,
	lane: ParcelLane,
	from: MovementNode,
	to: MovementNode,
	portals: readonly ParcelPortal[],
	nodes: Map<string, MovementNode>,
	portalNodeIds: Map<string, string>,
	frontageClear: (a: Vec2, b: Vec2) => boolean
): Link[] {
	const {
		id,
		widthM,
		hierarchy,
		surface,
		points: [[x, y], [u, v]]
	} = lane;
	// Exact arithmetic: zero and one are the endpoints of the segment parameter.
	const stops = new Map([
		[0, from],
		[1, to]
	]);
	const links: Link[] = [];
	const ground = (key: string, [px, py]: Vec2): MovementNode => ({
		id: key,
		level: 'ground',
		position: [px, py, site.sampleGround(px, py).height]
	});
	for (const portal of portals) {
		const midpoint = frontageMidpoint(portal);
		const t = laneParameter(midpoint, lane);
		const xy: Vec2 = [x + (u - x) * t, y + (v - y) * t];
		if (!frontageClear(midpoint, xy)) continue;
		const tap = stops.get(t) ?? ground('lane-tap/' + id + '/' + t, xy);
		const entry = ground(portal.id, midpoint);
		const via = drape(tap.position, entry.position, site);
		// A frontage can meet the lane centerline at its endpoint.
		if (tap.position.every((value, i) => value === entry.position[i])) {
			stops.set(t, tap);
			nodes.set(tap.id, tap);
			portalNodeIds.set(portal.id, tap.id);
			continue;
		}
		stops.set(t, tap);
		nodes.set(tap.id, tap);
		nodes.set(entry.id, entry);
		portalNodeIds.set(portal.id, entry.id);
		links.push(link('access/' + portal.id, 'lane', tap, entry, via));
	}
	const ordered = [...stops].sort(([a], [b]) => a - b);
	for (let i = 1; i < ordered.length; i++) {
		const [t, a] = ordered[i - 1];
		const [end, b] = ordered[i];
		const key = 'lane/' + id + '/' + t + '/' + end;
		links.push(
			link(key, 'lane', a, b, drape(a.position, b.position, site), undefined, {
				widthM,
				hierarchy,
				surface
			})
		);
	}
	return links;
}
