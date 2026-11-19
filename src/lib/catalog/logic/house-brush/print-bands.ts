import type { Primitive, Vec3 } from '../parametrik/types';
import type { Point2 } from '../parametrik/vocab';
import { BODY_TOKEN } from '../../data/house-body';
import type { Site } from './form';
import type { Mass, Story } from './massing';
import { boundaryRuns, insetRing, roundRingCorners } from './outline';
import { abuttingInks, lapInk, type Contact, type PrintOrder } from './print-contact';
import type { Profile } from './profile';

const WIDTH = 0.5;
const WALL_OFFSET_M = 0.002;
type Wall = Extract<Primitive, { kind: 'prism' }>;
type Side = { story: Story; index: number };

function cornerMid(points: Point2[]): Point2[] {
	const at = Math.floor(points.length / 2);
	if (points.length % 2) return points;
	const [a, b] = [points[at - 1], points[at]];
	return [...points.slice(0, at), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...points.slice(at)];
}

function wallSides(ring: Point2[], profile: Profile) {
	const corners = roundRingCorners(insetRing(ring, profile.wallInset), profile.fillet).map(
		cornerMid
	);
	return corners.map((from, index) => {
		const to = corners[(index + 1) % corners.length];
		return [...from.slice(from.length >> 1), ...to.slice(0, (to.length >> 1) + 1)];
	});
}

/** Clips half a meter of a wall polyline, measured from the specified end. */
function strip(line: Point2[], tail: boolean): Point2[] {
	const points = tail ? line.slice().reverse() : line;
	const result = [points[0]];
	let remaining = WIDTH;
	for (let i = 1; i < points.length && remaining > 0; i++) {
		const [a, b] = [points[i - 1], points[i]];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const share = Math.min(1, remaining / (length || 1));
		result.push([a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share]);
		remaining -= length;
	}
	return tail ? result.reverse() : result;
}

function patch(wall: Wall, id: string, line: Point2[], { use, bottom, top }: Contact): Primitive[] {
	if (top <= bottom || line.length < 2) return [];
	const points: Vec3[] = [];
	const triangles: number[] = [];
	for (let i = 1; i < line.length; i++) {
		const [a, b] = [line[i - 1], line[i]];
		const dx = b[0] - a[0],
			dy = b[1] - a[1];
		const epsilon = WALL_OFFSET_M / (Math.hypot(dx, dy) || 1);
		const at = (p: Point2, z: number): Vec3 => [p[0] + dy * epsilon, p[1] - dx * epsilon, z];
		const n = points.length;
		points.push(at(a, bottom), at(b, bottom), at(b, top), at(a, top));
		triangles.push(n, n + 1, n + 2, n, n + 2, n + 3);
	}
	return [
		{
			id: wall.id + ':overprint:' + id,
			kind: 'mesh',
			role: 'neu',
			material: wall.material,
			envelope: true,
			token: wall.token,
			overprint: BODY_TOKEN[use],
			edges: false,
			points,
			triangles,
			lines: []
		}
	];
}

function contacts(site: Site, mass: Mass, side: Side, order: PrintOrder) {
	const id = side.story.cell.neighbors[side.index];
	return abuttingInks(
		site.stacks,
		mass,
		side.story,
		id ? site.grid.cellsById.get(id) : undefined,
		order
	);
}

function strips(wall: Wall, id: string, line: Point2[], ends: Contact[][], top: number) {
	return ends.flatMap((contacts, tail) =>
		contacts.flatMap((ink, i) =>
			patch(wall, id + '/abut/' + tail + '/' + i, strip(line, Boolean(tail)), {
				...ink,
				bottom: Math.max(ink.bottom, wall.z),
				top: Math.min(ink.top, top)
			})
		)
	);
}

function bandsAt(
	wall: Wall,
	id: string,
	line: Point2[],
	lap: Contact['use'] | undefined,
	ends: Contact[][]
) {
	const top = wall.z + wall.height;
	const bandBottom = lap ? top - WIDTH : top;
	const sides = strips(wall, id, line, ends, bandBottom);
	if (lap) sides.push(...patch(wall, id + '/lap', line, { use: lap, bottom: bandBottom, top }));
	return sides;
}

function bandsOfRun(
	site: Site,
	mass: Mass,
	profile: Profile,
	wall: Wall,
	order: PrintOrder,
	run: ReturnType<typeof boundaryRuns>[number],
	ringIndex: number,
	stories: Map<string, Story>
) {
	const ring = run.map(({ from: [x, y] }): Point2 => [x, y]);
	const sides = run.map(({ cellId, index }) => {
		const story = stories.get(cellId);
		if (!story) throw Error('Missing story on print boundary');
		return { story, index };
	});
	const abuts = sides.map((side) => contacts(site, mass, side, order));
	return wallSides(ring, profile).flatMap((line, index) => {
		const lap = lapInk(site.stacks, mass, sides[index].story, order);
		const ends = [abuts[(index + run.length - 1) % run.length], abuts[(index + 1) % run.length]];
		return bandsAt(wall, ringIndex + '/' + index, line, lap, ends);
	});
}

/** Detached lap and flank patches in wall order, appended by the wall's grammar. */
export function printBands(site: Site, mass: Mass, profile: Profile, wall: Wall): Primitive[] {
	const order = site.printOrder;
	if (!order || !mass.stories.some(({ cell, level }) => order(cell, level) !== undefined))
		return [];
	const cells = mass.stories.map(({ cell }) => cell);
	const stories = new Map(mass.stories.map((story) => [story.cell.id, story]));
	const runs = boundaryRuns(cells, (id) => stories.has(id));
	return runs.flatMap((run, i) => bandsOfRun(site, mass, profile, wall, order, run, i, stories));
}
