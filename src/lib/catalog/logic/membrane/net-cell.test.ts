import { expect, test } from 'bun:test';
import { clothColumns, clothIntervals, clothOpening, clothSurface, simulateCloth } from './index';

test('both diagonal cables follow triangle edges across every occupied course', () => {
	const cols = clothColumns(20, 'net');
	const bays = cols / clothIntervals;
	const mesh = clothSurface(cols, 2, 'net', (u, course, v) => [u, course + v, 0]);
	let crossed = 0;
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const face = mesh.triangles.slice(i, i + 3).map((k) => mesh.points[k]);
		const course = Math.floor(Math.min(...face.map((p) => p[1])));
		for (const sign of [-1, 1]) {
			const phases = face.map(([u, y]) => u * bays + (sign * (y - course)) / 2);
			// A cable at an integer phase may touch a triangle, but must never cut its interior.
			if (Math.ceil(Math.min(...phases) + 1e-9) < Math.max(...phases) - 1e-9) crossed++;
		}
	}
	expect(crossed).toBe(0);
	const cells = Array.from({ length: cols * clothIntervals }, (_, k) =>
		clothOpening(k % cols, Math.floor(k / cols)) ? 0 : 1
	);
	expect(mesh.triangles.length).toBe(cells.filter(Boolean).length * 2 * 8 * 6);
});

test('the reconstructed course has one smooth crest between diagonal cables', () => {
	const cols = clothColumns(6, 'net');
	const field = simulateCloth({ restraint: 'net', pressure: 2, tension: 1 }, cols, 6, 8);
	const row = field.slice((clothIntervals / 2) * (cols + 1));
	const start = cols / 4,
		centre = cols / 2,
		end = (3 * cols) / 4;
	expect(row[start]).toBeCloseTo(0, 12);
	expect(row[end]).toBeCloseTo(0, 12);
	for (let i = start; i < centre; i++) expect(row[i + 1]).toBeGreaterThan(row[i]);
	for (let i = centre; i < end; i++) expect(row[i + 1]).toBeLessThan(row[i]);
});
