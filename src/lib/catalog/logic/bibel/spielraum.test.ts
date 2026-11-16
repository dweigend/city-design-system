// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { ablauf, messe, naechsteEcke, netzBei, punkt, traeger, ziehe } from './spielraum';

/** Choreography and angle sites of the leeway loop: executable examples. */
describe('Choreography of the leeway loop', () => {
	test('transitions are continuous: every phase ends where the next one begins', () => {
		for (let i = 0; i < 3; i++) {
			const ende = ablauf(i, 1),
				anfang = ablauf((i + 1) % 3, 0);
			for (const k of ['verzug', 'geist', 'nachbarn', 'hin', 'raum'] as const)
				expect(Math.abs(ende[k] - anfang[k])).toBeLessThan(1e-9);
		}
	});
	test('no phase jumps: small time steps, small changes', () => {
		for (let i = 0; i < 3; i++)
			for (let a = 0; a < 1; a += 0.002) {
				const x = ablauf(i, a),
					y = ablauf(i, a + 0.002);
				for (const k of ['verzug', 'geist', 'nachbarn', 'hin', 'raum'] as const)
					expect(Math.abs(x[k] - y[k])).toBeLessThan(0.03);
			}
	});
	test('zone and corner move only at distortion ½, where their leeway applies', () => {
		for (let a = 0; a <= 1; a += 0.01) {
			const z = ablauf(2, a);
			if (z.hin > 0 || z.raum > 0) expect(z.verzug).toBe(0.5);
		}
	});
});

describe('Angle sites', () => {
	const t = traeger(19);
	test('straight mesh: all angles 90°, sites lie at the corner or its neighbors', () => {
		const p = netzBei(t, 0),
			id = naechsteEcke(p, t.frei, [0, 0]),
			m = messe(p, id);
		expect(m.spitz.grad).toBeCloseTo(90, 6);
		expect(m.weit.grad).toBeCloseTo(90, 6);
		const e = punkt(p, id);
		expect(Math.hypot(m.spitz.scheitel[0] - e[0], m.spitz.scheitel[1] - e[1])).toBeLessThan(10.01);
	});
	test('at the boundary the site names the angle that stops the corner', () => {
		const p = netzBei(t, 0.5),
			id = naechsteEcke(p, t.frei, [0, 0]),
			a = punkt(p, id),
			r = ziehe(p, id, [a[0] + 40, a[1]]).punkt;
		const q = { ...p, vertices: p.vertices.map((v) => (v.id === id ? { ...v, point: r } : v)) };
		const m = messe(q, id);
		expect(m.kleinster).toBe(m.spitz.grad);
		expect(m.groesster).toBe(m.weit.grad);
		expect(m.spitz.grad < 6 || m.weit.grad > 178).toBe(true);
	});
});
