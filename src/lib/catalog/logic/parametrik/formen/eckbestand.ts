/**
 * Existing-stock details for the corner modules (form): punched facade as gray hairlines, round
 * arches on the ground floor, gable roof (eaves to the alley) with chimney, corner turret with spire.
 * The volume itself comes from eckModul (existing-stock bits). References 33, 36, 43: existing stock as a fine line.
 */
import type { Primitive, Vec3 } from '../types';
import type { Point2 } from '../vocab';
import type { Haus } from '../eckraster/bestand';
import { fitRect, inset } from './geom';

const B = { role: 'bestand', token: '--paper', material: 'concrete' } as const;
const STOREY = 4,
	FENSTER_B = 1.05,
	FENSTER_H = 1.85,
	BRUESTUNG = 1.05,
	ACHSE = 2.3,
	BOGEN_B = 1.5,
	BOGEN_H = 2.9,
	DACH_MAX = 3.6;

/** Point on the facade: t along a → b, h above z, slightly in front of the wall. */
function onWall(a: Point2, b: Point2, out: Point2, t: number, z: number): Vec3 {
	return [a[0] + (b[0] - a[0]) * t + out[0] * 0.04, a[1] + (b[1] - a[1]) * t + out[1] * 0.04, z];
}

/** Openings of a facade piece: window axes, round arches on the ground floor. */
function oeffnungen(h: Haus, out: Primitive[]) {
	h.fassaden.forEach((f, k) => {
		const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
		if (len < 1.7) return;
		const n = Math.max(1, Math.floor((len - 0.3) / ACHSE));
		for (const level of f.levels) {
			const z0 = level * STOREY;
			for (let j = 0; j < n; j++) {
				const tc = (len / 2 + (j - (n - 1) / 2) * ACHSE) / len;
				const pts: Vec3[] = [];
				if (level === 0) {
					// Round arch: posts, semicircle, open toward the ground.
					const w = BOGEN_B / 2 / len,
						r = BOGEN_B / 2,
						spring = z0 + BOGEN_H - r;
					pts.push(onWall(f.a, f.b, f.out, tc - w, z0 + 0.02));
					for (let s = 0; s <= 10; s++) {
						const a = Math.PI - (s / 10) * Math.PI;
						pts.push(
							onWall(f.a, f.b, f.out, tc + (Math.cos(a) * r) / len, spring + Math.sin(a) * r)
						);
					}
					pts.push(onWall(f.a, f.b, f.out, tc + w, z0 + 0.02));
					out.push({ ...B, id: `bestand:${h.id}:bogen:${k}:${j}`, kind: 'polyline', points: pts });
				} else {
					const w = FENSTER_B / 2 / len,
						zb = z0 + BRUESTUNG;
					out.push({
						...B,
						id: `bestand:${h.id}:fenster:${k}:${level}:${j}`,
						kind: 'polyline',
						closed: true,
						points: [
							onWall(f.a, f.b, f.out, tc - w, zb),
							onWall(f.a, f.b, f.out, tc + w, zb),
							onWall(f.a, f.b, f.out, tc + w, zb + FENSTER_H),
							onWall(f.a, f.b, f.out, tc - w, zb + FENSTER_H)
						]
					});
				}
			}
		}
	});
}

/** Gable roof: two wedges over the largest ridge-parallel rectangle, chimney at the ridge. */
function satteldach(h: Haus, z: number, out: Primitive[]) {
	const r = fitRect(h.outline, h.center, h.first);
	if (r.hu < 1 || r.hv < 1) return;
	const a = h.first,
		cos = Math.cos(a),
		sin = Math.sin(a);
	const at = (u: number, v: number): Point2 => [
		h.center[0] + u * cos - v * sin,
		h.center[1] + u * sin + v * cos
	];
	const rise = Math.min(DACH_MAX, r.hv * 0.95);
	for (const side of [1, -1]) {
		const [cx, cy] = at(r.cu, r.cv + (side * r.hv) / 2);
		out.push({
			...B,
			id: `bestand:${h.id}:dach:${side}`,
			kind: 'wedge',
			position: [cx - r.hv / 2, cy - r.hu, z],
			size: [r.hv, r.hu * 2, rise],
			low: 0,
			rotation: a + (side * Math.PI) / 2,
			shade: 0.1
		});
	}
	const [sx, sy] = at(r.cu + r.hu * 0.45, r.cv + 0.35);
	out.push({
		...B,
		id: `bestand:${h.id}:schornstein`,
		kind: 'box',
		position: [sx - 0.3, sy - 0.3, z],
		size: [0.6, 0.6, rise + 0.7],
		rotation: a
	});
}

/** Corner turret at the block corner: cylinder with a conical spire on the eaves. */
function eckturm(h: Haus, z: number, out: Primitive[]) {
	if (!h.corner) return;
	const t = 0.3,
		p: Point2 = [
			h.corner[0] + (h.center[0] - h.corner[0]) * t,
			h.corner[1] + (h.center[1] - h.corner[1]) * t
		];
	out.push(
		{
			...B,
			id: `bestand:${h.id}:turm`,
			kind: 'cylinder',
			position: [p[0], p[1], z],
			radius: 1.5,
			height: 2.6
		},
		{
			...B,
			id: `bestand:${h.id}:helm`,
			kind: 'cone',
			position: [p[0], p[1], z + 2.6],
			radius: 1.75,
			height: 3.4,
			shade: 0.1
		}
	);
}

/** Flat roof with eaves: a low roof structure (stair bulkhead) as a quiet edge. */
function traufdach(h: Haus, z: number, out: Primitive[]) {
	const poly = inset(h.outline, 1.4, h.center);
	out.push({
		...B,
		id: `bestand:${h.id}:aufbau`,
		kind: 'prism',
		polygon: poly,
		z,
		height: 0.9,
		shade: 0.08
	});
}

/** All details of an existing house (without the volume). */
export function bestandDetails(h: Haus): Primitive[] {
	const out: Primitive[] = [];
	oeffnungen(h, out);
	const z = h.levels * STOREY;
	if (h.dach === 'sattel') satteldach(h, z, out);
	else if (h.dach === 'eckturm') eckturm(h, z, out);
	else if (h.dach === 'traufe') traufdach(h, z, out);
	return out;
}
