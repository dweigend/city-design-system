import { blockOutline } from './block-outline';
import { solid } from './objects';
import type { Body, Solid } from './types';

type XY = [number, number];
type Course = Extract<Solid, { kind: 'prism' }>;
function windows(course: Course, body: Body): Course[] {
	const [x, y, z] = body.position,
		[w, d] = body.size;
	const rear = y + (body.facing[1] * d) / 2;
	const inset = (ring: XY[]) =>
		ring.map(([u, v]): XY => [
			u -
				(Math.sign(u - x) * 0.35 * Math.max(0, Math.abs(u - x) - 0.58)) /
					Math.max(0.01, w / 2 - 0.58),
			v + (body.facing[1] * 0.35 * Math.max(0, Math.abs(rear - v) - 0.7)) / Math.max(0.01, d - 0.7)
		]);
	const ends = [course.z, course.z + course.height];
	for (let sill = z + 1; sill < ends[1]; sill += 4)
		for (const cut of [sill, sill + 1]) if (cut > ends[0] && cut < ends[1]) ends.push(cut);
	ends.sort((a, b) => a - b);
	return ends.slice(1).map((end, i) => {
		const at = ends[i],
			phase = ((at + end) / 2 - z) % 4;
		const glazing = phase >= 1 && phase < 2;
		return {
			...course,
			id: course.id + '/' + (glazing ? 'window' : 'wall') + '-' + i,
			z: at,
			height: end - at,
			polygon: glazing ? inset(course.polygon) : course.polygon
		};
	});
}
/** Cuts a ladder recess and its full-height door from the rear face of a compact body. */
export function blockSkin(body: Body, ground: number): Solid[] {
	const [x, y, z] = body.position,
		[w, d, h] = body.size;
	const sign = body.facing[1],
		rear = y + (sign * d) / 2;
	const axis = body.band?.wellX ?? x;
	const local = (u: number, v: number): XY => [u, rear - sign * v];
	const a = axis - 0.58,
		b = axis + 0.58;
	const ring = (p: number[][]) => p.map(([u, v]) => local(u, v));
	const hole = ring([
		[a, 0.12],
		[a, 0.65],
		[b, 0.65],
		[b, 0.12]
	]);
	const doorway = Math.min(2.1, h);
	const course = (
		name: string,
		base: number,
		height: number,
		open: boolean
	): Extract<Solid, { kind: 'prism' }> => ({
		...solid(
			body.id + '/' + name,
			'cantilever',
			'body',
			[x, y, z + base],
			[w, d, height],
			ground,
			body.use
		),
		kind: 'prism',
		z: z + base,
		height,
		polygon: blockOutline(
			body.position,
			w,
			d,
			sign,
			open ? { x: axis, halfWidth: 0.58, depth: 0.65 } : undefined,
			true
		),
		holes: open ? undefined : [hole]
	});
	const jamb = course('jamb', 0, doorway, true);
	return [
		...windows(jamb, body),
		{
			...course('door', 0.16, doorway - 0.16, false),
			polygon: ring([
				[a + 0.015, 0.015],
				[a + 0.015, 0.135],
				[b - 0.015, 0.135],
				[b - 0.015, 0.015]
			]),
			holes: undefined
		},
		...(h > doorway ? windows(course('wall', doorway, h - doorway, false), body) : [])
	];
}
