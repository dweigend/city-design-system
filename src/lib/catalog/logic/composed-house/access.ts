import { flowToken } from '../../data/focus';
import type { Vec3 } from '../parametrik/types';
import { walkwayParts } from '../walkway';
import { piece } from './parts';
import type { Section } from './types';

function flight(id: string, a: Vec3, b: Vec3, width: number) {
	const parts = walkwayParts(
		[a, b],
		{ id, width, groundZ: Math.max(a[2], b[2]), simplifyAtCity: true },
		{ thickness: 0.12, treadRise: 0.32 }
	);
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		scale = (width * 0.46) / Math.hypot(dx, dy);
	for (const side of [-1, 1]) {
		const shift = ([x, y, z]: Vec3): Vec3 => [x - side * dy * scale, y + side * dx * scale, z];
		parts.push(
			piece(
				id + '/stringer/' + side,
				{ kind: 'pipe', points: [shift(a), shift(b)], radius: Math.min(width * 0.095, 0.115) },
				flowToken.people
			)
		);
	}
	return parts;
}
function perimeter(s: Section, angle: number, z: number): Vec3 {
	const [x, y] = s.base;
	return [x + Math.cos(angle) * s.width * 0.46, y + Math.sin(angle) * s.depth * 0.46, z];
}
function spiral(s: Section) {
	let angle = -Math.PI * 0.72,
		z = s.base[2] + 0.15;
	const route = [perimeter(s, angle, z)];
	for (const d of s.decks) {
		const rise = d.position[2] - z;
		for (let j = 1; j <= 4; j++)
			route.push(perimeter(s, angle + (j * Math.PI) / 9, z + (rise * j) / 4));
		angle += (4 * Math.PI) / 9;
		z = d.position[2];
	}
	const target = Math.PI * 0.25 + 2 * Math.PI * Math.ceil((angle - Math.PI * 0.25) / (2 * Math.PI));
	const steps = Math.max(1, Math.ceil((target - angle) / (0.16 * Math.PI)));
	for (let i = 1; i <= steps; i++)
		route.push(perimeter(s, angle + ((target - angle) * i) / steps, z + ((s.top - z) * i) / steps));
	return route;
}
function switchback(s: Section) {
	const [x, y, z] = s.base,
		front = y - s.depth * 0.45;
	const route: Vec3[] = [[x - s.width * 0.35, front, z + 0.15]];
	for (const [i, d] of s.decks.entries())
		route.push([d.position[0] + d.width * (i % 2 ? -0.37 : 0.37), front, d.position[2]]);
	const last = route.at(-1)!,
		side = last[0] > x ? 1 : -1;
	const edge = s.decks.at(-1)!.position[0] + side * s.decks.at(-1)!.width * 0.455;
	route.push(
		[edge, front, last[2]],
		[edge, y + s.depth * 0.29, s.top],
		[x + side * s.width * 0.32, y + s.depth * 0.29, s.top]
	);
	return route;
}
/** Exterior switchbacks or a polygonal spiral connect every walking surface to the pad. */
export function access(s: Section) {
	const path = s.plan === 'round' ? spiral(s) : switchback(s);
	return path
		.slice(1)
		.flatMap((p, i) =>
			flight(s.id + '/stair/' + i, path[i], p, Math.max(0.5, Math.min(1.35, s.width * 0.1)))
		);
}
