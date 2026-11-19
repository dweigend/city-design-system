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

test('a city-edge run bears directly on the ground at both column endpoints', () => {
	// The terrain rises one metre over the eight-metre run. Both columns are vertical.
	const ground = (x: number) => 3 + x / 8;
	const contacts: StructuralContact[] = [0, 8].map((x) => ({
		member: { id: 'edge-column/' + x, diameter: 0.4 },
		support: { id: 'terrain/riverbank', diameter: 2 },
		seat: 'terrain',
		point: [x, 0, ground(x)],
		axis: [0, 0, 1],
		supportNormal: [-1 / 8, 0, 1],
		owner: 'edge-run',
		anchor: 'foot',
		built: 2026,
		stroke: 'main'
	}));
	const shoes = deriveStructuralJoints(contacts);
	expect(shoes).toHaveLength(2);
	for (const [i, shoe] of shoes.entries()) {
		expect(shoe.point).toEqual(contacts[i].point);
		expect(shoe.type).toBe('shoe');
		const [plate, dot] = shoe.geometry;
		expect([plate.feature, dot.feature]).toEqual(['plate', 'dot']);
		const clearance = ([x, , z]: Vec3) => shoe.point[2] + z - ground(shoe.point[0] + x);
		expect([...plate.points, ...dot.points].every((p) => clearance(p) >= -1e-10)).toBe(true);
		// An underside triangle with positive area bears on the ground across its whole face.
		let bearingArea = 0;
		for (let j = 0; j < plate.triangles.length; j += 3) {
			const face = plate.triangles.slice(j, j + 3).map((k) => plate.points[k]);
			if (!face.every((p) => Math.abs(clearance(p)) < 1e-10)) continue;
			const [a, b, c] = face;
			bearingArea += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
		}
		expect(bearingArea).toBeGreaterThan(0);
	}
});
