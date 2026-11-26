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
	if (!(count > 1)) return [];
	const points = new Array<Vec3>(count - 1);
	for (let i = 1; i < count; i++) {
		const t = i / count;
		const x = a[0] + dx * t;
		const y = a[1] + dy * t;
		points[i - 1] = [x, y, site.sampleGround(x, y).height];
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
	const normalizeZero = (value: number) =>
		value === /* Exact arithmetic: collapse signed zero before position lookup. */ 0
			? /* Exact arithmetic: canonical positive zero. */ 0
			: value;
	const positionKey = ([px, py]: Vec2) => JSON.stringify([normalizeZero(px), normalizeZero(py)]);
	const fromKey = positionKey([from.position[0], from.position[1]]);
	const toKey = positionKey([to.position[0], to.position[1]]);
	const contacts = new Map<
		string,
		{ t: number; xy: Vec2; items: { portal: ParcelPortal; midpoint: Vec2 }[] }
	>();
	for (const portal of portals) {
		const midpoint = frontageMidpoint(portal);
		const t = laneParameter(midpoint, lane);
		const xy: Vec2 = [normalizeZero(x + (u - x) * t), normalizeZero(y + (v - y) * t)];
		if (!frontageClear(midpoint, xy)) continue;
		const key = positionKey(xy);
		const group = contacts.get(key);
		if (group) {
			group.t = Math.min(group.t, t);
			group.items.push({ portal, midpoint });
		} else contacts.set(key, { t, xy, items: [{ portal, midpoint }] });
	}
	for (const [key, { t, xy, items }] of contacts) {
		const incident = items.map(({ portal }) => portal.id).sort();
		const tap =
			key === fromKey
				? from
				: key === toKey
					? to
					: (stops.get(t) ?? ground('lane-tap/' + JSON.stringify([id, incident]), xy));
		if (tap !== from && tap !== to) stops.set(t, tap);
		nodes.set(tap.id, tap);
		for (const { portal, midpoint } of items) {
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
		if (a.id === b.id || a.position.every((value, index) => value === b.position[index])) continue;
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
