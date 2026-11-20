import { expect, test } from 'bun:test';
import { Matrix4, Vector3 } from 'three/webgpu';
import type { StructuralContact } from '../../logic/structural-joints';
import { bearingSeats, contactWash } from './contact-wash';

test('only upward mass contacts receive a warm wash one member diameter in radius', () => {
	const fixture: StructuralContact = {
		seat: 'terrain',
		point: [1, 2, 3],
		axis: [0, 0, 1],
		supportNormal: [0, 0, 1],
		member: { id: 'post', diameter: 0.18 },
		support: { id: 'support', diameter: 2 },
		anchor: '0',
		owner: 'study',
		built: 1,
		stroke: 'main'
	};
	const seats = bearingSeats(
		(
			[
				'terrain',
				'wall-crest',
				'slab-seam',
				'chord',
				'frame-corner',
				'rail-saddle',
				'block-transition'
			] as const
		).map((seat) => ({ ...fixture, seat }))
	);
	expect(seats.length).toBe(3);
	expect(bearingSeats([{ ...fixture, seat: 'slab-seam', supportNormal: [0, 0, -1] }])).toEqual([]);
	const mesh = contactWash(seats);
	if (!mesh) throw Error('Missing supported contact');
	expect(mesh.count).toBe(1);
	const matrix = new Matrix4();
	mesh.getMatrixAt(0, matrix);
	expect(new Vector3().setFromMatrixScale(matrix).x / 2).toBeCloseTo(fixture.member.diameter);
	expect(mesh.material.opacity).toBe(0.25);
	expect(mesh.material.color.getHex()).toBe(0x82776c);
	mesh.dispose();
	mesh.geometry.dispose();
	mesh.material.dispose();
});
