import type { Vec2, Vec3 } from '../../core/geometry';
import type { ParcelLane, ParcelPortal } from '../../domain/parcels';
import type { MovementNode } from '../../domain/movement-network';
import { defaults } from '../../../config/city-movement';
import type { CitySite } from '../city-site';
import { link, type Link } from './links';

export function drape(a: Vec3, b: Vec3, site: CitySite): Vec3[] {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const count = Math.ceil(Math.hypot(dx, dy) / defaults.groundTraceStepM);
	const points: Vec3[] = [];
	for (let i = 1; i < count; i++) {
		const t = i / count;
		const x = a[0] + dx * t;
		const y = a[1] + dy * t;
		points.push([x, y, site.sampleGround(x, y).height]);
	}
	return points;
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
	frontageClear: (a: Vec2, b: Vec2) => boolean,
	links: Link[]
) {
	const {
		id,
		widthM,
		hierarchy,
		surface,
		points: [[x, y], [u, v]]
	} = lane;
	// Exact arithmetic: zero and one are the endpoints of the segment parameter.
	const stops = new Map(
		/* Exact arithmetic: parameters at the start and end of the segment. */ [
			[0, from],
			[1, to]
		]
	);
	const ground = (key: string, [px, py]: Vec2): MovementNode => ({
		id: key,
		level: 'ground',
		position: [px, py, site.sampleGround(px, py).height]
	});
	const contacts = new Map<number, { portal: ParcelPortal; midpoint: Vec2; xy: Vec2 }[]>();
	for (const portal of portals) {
		const midpoint = frontageMidpoint(portal);
		const t = laneParameter(midpoint, lane);
		const xy: Vec2 = [x + (u - x) * t, y + (v - y) * t];
		if (!frontageClear(midpoint, xy)) continue;
		const group = contacts.get(t);
		const contact = { portal, midpoint, xy };
		if (group) group.push(contact);
		else contacts.set(t, [contact]);
	}
	for (const [t, group] of contacts) {
		const incident = group.map(({ portal }) => portal.id).sort();
		const tap = stops.get(t) ?? ground('lane-tap/' + JSON.stringify([id, incident]), group[0].xy);
		stops.set(t, tap);
		nodes.set(tap.id, tap);
		for (const { portal, midpoint } of group) {
			const entry = ground(portal.id, midpoint);
			// A frontage can meet the lane centerline directly.
			if (tap.position.every((value, i) => value === entry.position[i])) {
				portalNodeIds.set(portal.id, tap.id);
				continue;
			}
			nodes.set(entry.id, entry);
			portalNodeIds.set(portal.id, entry.id);
			links.push(
				link('access/' + portal.id, 'lane', tap, entry, drape(tap.position, entry.position, site))
			);
		}
	}
	const ordered = [...stops].sort(([a], [b]) => a - b);
	for (let i = 1; i < ordered.length; i++) {
		const [, a] = ordered[i - 1];
		const [, b] = ordered[i];
		const key = 'lane/' + JSON.stringify([id, a.id, b.id]);
		links.push(
			link(key, 'lane', a, b, drape(a.position, b.position, site), undefined, {
				widthM,
				hierarchy,
				surface
			})
		);
	}
}
