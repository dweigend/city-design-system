import { expect, test } from 'bun:test';
import { hash } from '../hash-random';
import type { Vec3 } from '../traeger';
import { deriveStructuralJoints, type StructuralContact } from './index';

const seats = [
	'terrain',
	'wall-crest',
	'chord',
	'frame-corner',
	'block-transition',
	'roof-step',
	'rail-saddle'
] as const;

function contact(seed: number, i: number): StructuralContact {
	const draw = (channel: number) => hash(seed, i, channel);
	return {
		member: { id: 'column/' + (i % 2), diameter: 0.04 + draw(0) * 4 },
		support: { id: 'frame', diameter: 0.02 + draw(1) * 6 },
		seat: seats[i % seats.length],
		point: [draw(2), draw(3), draw(4)],
		axis: [draw(5) - 0.5, draw(6) - 0.5, draw(7) - 0.5],
		owner: 'block',
		built: 1900 + Math.floor(draw(8) * 180),
		anchor: String(i),
		stroke: 'main'
	};
}

// In the local tangent chart, find the closest point of each projected triangle edge.
// A triangle containing the origin has zero clearance even when all edges clear the bore.
function radialReach(points: Vec3[]) {
	let minimum = Infinity;
	const sides = points.map(([x, y], i) => {
		const [nx, ny] = points[(i + 1) % 3];
		const dx = nx - x,
			dy = ny - y,
			length2 = dx * dx + dy * dy;
		const t = length2 ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length2)) : 0;
		minimum = Math.min(minimum, Math.hypot(x + t * dx, y + t * dy));
		return x * ny - y * nx;
	});
	return sides.every((s) => s > 0) || sides.every((s) => s < 0) ? 0 : minimum;
}

test('each seat derives its fitting and retains the address and time layer', () => {
	for (const [i, seat] of seats.entries()) {
		const c = contact(1, i);
		const [joint] = deriveStructuralJoints([c]);
		const shoe = seat === 'terrain' || seat === 'wall-crest';
		expect(joint).toMatchObject({
			type: shoe ? 'shoe' : 'cuff',
			built: c.built,
			owner: c.owner,
			anchor: c.anchor,
			point: c.point
		});
		expect(joint.geometry.map((mesh) => mesh.feature)).toEqual(
			shoe ? ['plate', 'dot'] : ['jaw', 'jaw', 'bolt', 'bolt']
		);
		expect(Math.hypot(...joint.axis)).toBeCloseTo(1, 12);
	}
});

test('random contact tables retain one fitting per site through reorder, local moves, removal and undo', () => {
	for (let seed = 0; seed < 12; seed++) {
		const contacts = seats.map((_, i) => contact(seed, i));
		const derive = deriveStructuralJoints;
		const joints = derive(contacts);
		expect(new Set(joints.map((j) => j.partId)).size).toBe(contacts.length);
		expect(derive([...contacts, ...contacts].reverse())).toEqual(joints);
		const [first, ...others] = contacts;
		const moved = derive([{ ...first, point: [8, 5, 2] }, ...others]);
		expect(moved.filter((j) => j.anchor !== first.anchor)).toEqual(derive(others));
		expect(derive([...others, first])).toEqual(joints);
		for (const joint of joints) {
			const c = contacts[Number(joint.anchor)];
			const width = Math.min(c.member.diameter, c.support.diameter) / 4;
			for (const mesh of joint.geometry) {
				expect(mesh.points.every((p) => p[2] >= 0 && p[2] <= width)).toBe(true);
				expect(
					mesh.points.every(([x, y]) => Math.hypot(x, y) <= c.member.diameter / 2 + width + 1e-10)
				).toBe(true);
				let minReach = Infinity;
				for (let i = 0; i < mesh.triangles.length; i += 3) {
					const tri = mesh.triangles.slice(i, i + 3).map((k) => mesh.points[k]);
					minReach = Math.min(minReach, radialReach(tri));
				}
				expect(minReach).toBeGreaterThanOrEqual(c.member.diameter / 2 - 1e-10);
			}
		}
	}
});

test('conflicting claims on a seat are rejected in either order', () => {
	const c = contact(2, 0);
	const changed = { ...c, built: c.built + 1 };
	for (const rows of [
		[c, changed],
		[changed, c]
	])
		expect(() => deriveStructuralJoints(rows)).toThrow('Conflicting');
});

test('oblique members meet a level crest without crossing the surveyed face', () => {
	for (let seed = 0; seed < 32; seed++) {
		const c = contact(seed, 1);
		c.axis[2] = Math.abs(c.axis[2]) + 0.1;
		c.supportNormal = [0, 0, 1];
		const [j] = deriveStructuralJoints([c]);
		const localYz = j.axis[0] * j.tangent[1] - j.axis[1] * j.tangent[0];
		const heights = j.geometry[0].points.map(
			([x, y, z]) => x * j.tangent[2] + y * localYz + z * j.axis[2]
		);
		expect(Math.min(...heights)).toBeCloseTo(0, 12);
		expect(heights.filter((h) => Math.abs(h) < 1e-10).length).toBeGreaterThanOrEqual(32);
	}
});
