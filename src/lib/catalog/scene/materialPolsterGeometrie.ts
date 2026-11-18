/**
 * Deep four-lobed membrane enclosure with fitted seams. Local x right, y up, z depth; hull
 * [w, h, d] centered in x/z with the base at y = 0. The plan is two crossing stadiums blended
 * with a fillet; the skin rises with a round profile from that plan and tucks under to the ground.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Polster = { ax: number; az: number; b: number; rim: number; arm: number; dome: number };
const STRAHLEN = 192;
const RINGE = 56;

function plan(w: number, d: number, h: number): Polster {
	const b = Math.min(w, d) * 0.21;
	const rim = h * 0.34;
	return { ax: w / 2 - b, az: d / 2 - b, b, rim, arm: h * 0.4, dome: h * 0.18 };
}

function stadion(laengs: number, quer: number, halb: number, b: number): number {
	return Math.hypot(Math.max(Math.abs(laengs) - halb, 0), quer) - b;
}

/** Signed plan distance in meters: negative inside. The fillet never extends past the hull. */
function abstand(p: Polster, x: number, z: number): number {
	const a = stadion(x, z, p.ax, p.b),
		c = stadion(z, x, p.az, p.b),
		k = p.b * 0.6;
	const t = Math.max(k - Math.abs(a - c), 0) / k;
	return Math.min(a, c) - t * t * k * 0.25;
}

/** Seam planes: two lengthwise lines per arm pair and one transverse ring per arm. */
function nahtLagen(p: Polster) {
	const c = p.b * 0.42;
	return { x: [-c, c, -p.ax * 0.78, p.ax * 0.78], z: [-c, c, -p.az * 0.78, p.az * 0.78] };
}

/** Gaussian groove that pulls the skin in along each seam plane. */
function kniff(p: Polster, x: number, z: number): number {
	const lagen = nahtLagen(p),
		breit = p.b * 0.11;
	let n = 0;
	for (const v of lagen.x) n = Math.max(n, Math.exp(-(((x - v) / breit) ** 2)));
	for (const v of lagen.z) n = Math.max(n, Math.exp(-(((z - v) / breit) ** 2)));
	return n * p.b * 0.045;
}

function rund(p: Polster, x: number, z: number): number {
	const innen = Math.min(1, Math.max(0, -abstand(p, x, z)) / p.b);
	return Math.sqrt(Math.max(0, 1 - (1 - innen) ** 2));
}

function oben(p: Polster, x: number, z: number): number {
	const r2 = (x * x + z * z) / (p.b * 2.4) ** 2;
	const kuppel = p.dome * Math.max(0, 1 - r2) ** 2;
	const g = rund(p, x, z);
	return p.rim + (p.arm - kniff(p, x, z)) * g + kuppel * g;
}

function unten(p: Polster, x: number, z: number): number {
	return Math.max(0, p.rim - p.rim * 1.25 * rund(p, x, z) + kniff(p, x, z) * 0.5);
}

/** Plan radius of the boundary along a ray, by bisection on the signed distance. */
function randRadius(p: Polster, dx: number, dz: number, weit: number): number {
	let lo = 0,
		hi = weit;
	for (let i = 0; i < 40; i++) {
		const m = (lo + hi) / 2;
		if (abstand(p, dx * m, dz * m) < 0) lo = m;
		else hi = m;
	}
	return lo;
}

function haut(p: Polster, weit: number): THREE.BufferGeometry {
	const pos: number[] = [0, oben(p, 0, 0), 0, 0, unten(p, 0, 0), 0];
	for (let i = 0; i < STRAHLEN; i++) {
		const a = (i / STRAHLEN) * Math.PI * 2;
		const [dx, dz] = [Math.cos(a), Math.sin(a)];
		const r = randRadius(p, dx, dz, weit);
		for (let j = 1; j <= RINGE; j++) {
			// Even spacing at the crown resolves the seam grooves; sine spacing resolves the rim.
			const u = 0.5 * (j / RINGE) + 0.5 * Math.sin(((j / RINGE) * Math.PI) / 2);
			const [x, z] = [dx * r * u, dz * r * u];
			pos.push(x, oben(p, x, z), z);
			if (j < RINGE) pos.push(x, unten(p, x, z), z);
		}
	}
	return vernetzen(pos);
}

/** Vertex index per ray: top rings 1..RINGE interleaved with bottom rings; the rim is shared. */
function ringIndex(i: number, j: number, top: boolean): number {
	const s = (i % STRAHLEN) * (2 * RINGE - 1) + 2;
	if (j === 0) return top ? 0 : 1;
	if (j === RINGE) return s + 2 * (RINGE - 1);
	return s + 2 * (j - 1) + (top ? 0 : 1);
}

/** Triangles of one cell; the bottom skin is wound the other way so both face outward. */
function zelle(i: number, j: number, top: boolean): number[] {
	const a = ringIndex(i, j, top),
		b = ringIndex(i + 1, j, top),
		c = ringIndex(i, j + 1, top),
		f = ringIndex(i + 1, j + 1, top);
	if (j === 0) return top ? [a, f, c] : [a, c, f];
	return top ? [a, b, c, b, f, c] : [a, c, b, b, c, f];
}

function vernetzen(pos: number[]): THREE.BufferGeometry {
	const indices: number[] = [];
	for (let i = 0; i < STRAHLEN; i++)
		for (let j = 0; j < RINGE; j++) indices.push(...zelle(i, j, true), ...zelle(i, j, false));
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(indices);
	g.computeVertexNormals();
	return g;
}

/**
 * Projects the lobed envelope inside the hull [w, h, d]. Stable vertex order, no randomness.
 * The caller owns the geometry.
 */
export function polsterGeometrie(w: number, d: number, h: number): THREE.BufferGeometry {
	return haut(plan(w, d, h), Math.hypot(w, d));
}

/** Offsets a skin point along its heightfield normal; steep rim slopes turn it horizontal. */
function aussen(p: Polster, x: number, z: number, top: boolean, um: number): THREE.Vector3 {
	const f = top ? oben : unten,
		e = 0.004,
		y = f(p, x, z);
	const gx = (f(p, x + e, z) - f(p, x - e, z)) / (2 * e);
	const gz = (f(p, x, z + e) - f(p, x, z - e)) / (2 * e);
	const n = top ? new THREE.Vector3(-gx, 1, -gz) : new THREE.Vector3(gx, -1, gz);
	return new THREE.Vector3(x, y, z).addScaledVector(n.normalize(), um);
}

/** Points of one seam plane (`quer` = constant z) from ground over the top to ground. */
function nahtPunkte(p: Polster, wert: number, quer: boolean, um: number): THREE.Vector3[] {
	const ort = (s: number) => (quer ? [s, wert] : [wert, s]) as [number, number];
	let lo = 0,
		hi = Math.hypot(p.ax, p.az) + 2 * p.b;
	for (let i = 0; i < 40; i++) {
		const m = (lo + hi) / 2;
		if (abstand(p, ...ort(m)) < 0) lo = m;
		else hi = m;
	}
	const rand = lo,
		punkte: THREE.Vector3[] = [];
	const add = (s: number, top: boolean) => {
		const [x, z] = ort(s);
		const y = top ? oben(p, x, z) : unten(p, x, z);
		if (top || y > um * 3) punkte.push(aussen(p, x, z, top, um));
	};
	const n = 48;
	const s = (i: number) => rand * Math.sin(((i / n) * Math.PI) / 2);
	for (let i = 1; i < n; i++) add(-s(i), false);
	for (let i = -n; i <= n; i++) add(s(i), true);
	for (let i = n - 1; i >= 1; i--) add(s(i), false);
	return punkte;
}

/** Light seam ribbons seated in the grooves of the lobed envelope. Caller owns the geometry. */
export function polsterNahtGeometrie(w: number, d: number, h: number): THREE.BufferGeometry {
	const p = plan(w, d, h);
	const radius = Math.max(0.016, Math.min(w, d) * 0.0034);
	const lagen = nahtLagen(p);
	const kurven = [
		...lagen.x.map((v) => nahtPunkte(p, v, false, radius * 0.75)),
		...lagen.z.map((v) => nahtPunkte(p, v, true, radius * 0.75))
	];
	const rohre = kurven.map(
		(pts) =>
			new THREE.TubeGeometry(
				new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
				pts.length * 3,
				radius,
				8
			)
	);
	const merged = mergeGeometries(rohre);
	for (const r of rohre) r.dispose();
	return merged;
}
