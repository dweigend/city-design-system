import { modelBevel } from './convex-creases';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { legacyRoleOf } from '../logic/parametrik/types';
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Primitive, Vec3 } from '../logic/parametrik/types';
import { fein, grob, kreisSegmente } from '../logic/parametrik/rundung';
/** Maps a world point to three.js axes. */
export const vector = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);
type Built = {
	geometry: THREE.BufferGeometry;
	position: THREE.Vector3;
	rotation: number;
	/** EdgesGeometry threshold in degrees. */
	edgeAngle: number;
	outline: boolean;
	double?: boolean;
	/** false: no crease edges (space frames draw centre lines instead). */
	edges?: boolean;
	/** Extra line segments (three coordinates, local), e.g. membrane rulings. */
	rulings?: number[];
};
type Solid = Exclude<Primitive, { kind: 'polyline' }>;
type Kind = Solid['kind'];
type SolidOf<K extends Kind> = Extract<Solid, { kind: K }>;
type Placement = ReturnType<typeof placePrimitive>;

function placePrimitive(part: Solid) {
	return (
		position: THREE.Vector3,
		geometry: THREE.BufferGeometry,
		more?: Partial<Built>
	): Built => ({
		geometry,
		position,
		rotation: part.rotation ?? 0,
		edgeAngle: 46,
		outline: false,
		...more
	});
}

/**
 * Projects a primitive into local three.js geometry with its world placement.
 * Coarse mode uses a larger chord tolerance and fewer samples along curves.
 */
export function build(part: Solid, coarse = false): Built {
	const at = placePrimitive(part);
	switch (part.kind) {
		case 'mesh':
			return buildMesh(part, at);
		case 'prism':
			return buildPrism(part, at);
		case 'box':
			return buildBox(part, at);
		case 'wedge':
			return buildWedge(part, at);
		case 'membrane':
			return buildMembrane(part, at);
		default:
			return buildCurved(part, at, coarse);
	}
}

function buildCurved(
	part: SolidOf<Exclude<Kind, 'mesh' | 'prism' | 'box' | 'wedge' | 'membrane'>>,
	at: Placement,
	coarse: boolean
): Built {
	switch (part.kind) {
		case 'pipe':
			return buildPipe(part, at, coarse);
		case 'ring':
			return buildRing(part, at, coarse);
		case 'cylinder':
		case 'cone':
			return buildCone(part, at, coarse);
		case 'sphere':
			return buildSphere(part, at, coarse);
		case 'dome':
			return buildDome(part, at, coarse);
		case 'capsule':
			return buildCapsule(part, at, coarse);
		case 'torus':
			return buildTorus(part, at, coarse);
		default:
			return buildProfiles(part, at, coarse);
	}
}

function buildProfiles(
	part: SolidOf<'arch' | 'vault' | 'halfpipe' | 'frame' | 'helix'>,
	at: Placement,
	coarse: boolean
): Built {
	switch (part.kind) {
		case 'arch':
		case 'vault':
		case 'halfpipe':
			return buildHalfpipe(part, at);
		case 'frame':
			return buildFrame(part, at);
		case 'helix':
			return buildHelix(part, at, coarse);
	}
}

function circleSegments(radius: number, coarse: boolean) {
	return kreisSegmente(radius, coarse ? grob : fein);
}

function pathSegments(count: number, coarse: boolean) {
	return coarse ? Math.max(6, Math.round(count * 0.4)) : count;
}

function buildMesh(p: SolidOf<'mesh'>, at: Placement) {
	const geometry = new THREE.BufferGeometry();
	const points = p.points.map(vector);
	geometry.setFromPoints(p.triangles.map((i) => points[i]));
	geometry.computeVertexNormals();
	const rulings =
		p.edges === false
			? []
			: p.lines.flatMap((path) =>
					path
						.slice(1)
						.flatMap((end, i) => [...points[path[i]].toArray(), ...points[end].toArray()])
				);
	return at(new THREE.Vector3(), geometry, { edges: false, rulings });
}

function buildPrism(p: SolidOf<'prism'>, at: Placement) {
	const shape = new THREE.Shape(p.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
	for (const hole of p.holes ?? [])
		shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: p.height, bevelEnabled: false });
	// Shape x/y → world x/-z (see vector), extrusion → up.
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(0, p.z, 0);
	return at(new THREE.Vector3(), geometry);
}

// Round dressed bodies inside their authored envelope. Thin sections keep a flat land.
function bevelRadius(part: Solid, smallestM: number, largestM: number) {
	if (!part.finish || legacyRoleOf(part) === 'bestand' || part.section) return 0;
	return modelBevel(smallestM, largestM);
}

function buildBox(p: SolidOf<'box'>, at: Placement) {
	const [w, d, h] = p.size;
	const radius = bevelRadius(p, Math.min(w, d, h), Math.max(w, d, h));
	return at(
		vector([
			p.position[0] + p.size[0] / 2,
			p.position[1] + p.size[1] / 2,
			p.position[2] + p.size[2] / 2
		]),
		radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d)
	);
}

function buildPipe(p: SolidOf<'pipe'>, at: Placement, coarse: boolean) {
	const curve = new THREE.CatmullRomCurve3(p.points.map(vector));
	// A straight pipe needs one segment along its length; curved paths keep the fine sampling.
	const along = p.points.length === 2 ? 1 : pathSegments(96, coarse);
	const geometry = new THREE.TubeGeometry(
		curve,
		along,
		p.radius,
		circleSegments(p.radius, coarse),
		false
	);
	return at(new THREE.Vector3(), geometry, { outline: true });
}

function buildRing(p: SolidOf<'ring'>, at: Placement, coarse: boolean) {
	if (p.curvature && p.curvature > p.radius) {
		// Shell on a sphere (Bullauge): the front follows the sphere, revolved around the axis.
		// Front steps from the same chord tolerance: a chord of length d on a circle of
		// radius R sags d² / (8R). The back lies under the skin and stays one straight chord.
		const R = p.curvature,
			h = (r: number) => Math.sqrt(R * R - r * r) - R,
			tolerance = coarse ? grob.tolerance : fein.tolerance,
			steps = Math.max(1, Math.ceil((p.radius - p.innerRadius) / Math.sqrt(8 * R * tolerance))),
			front: THREE.Vector2[] = [];
		for (let i = 0; i <= steps; i++) {
			const r = p.radius - ((p.radius - p.innerRadius) * i) / steps;
			front.push(new THREE.Vector2(r, h(r) + p.depth / 2));
		}
		const back = (r: number) => new THREE.Vector2(r, h(p.radius) - p.depth / 2);
		// Lathe revolves around local y. Profile inner back → outer → inner front keeps the
		// normals outward (the outline hull extrudes along them).
		const geometry = new THREE.LatheGeometry(
			[back(p.innerRadius), back(p.radius), ...front, back(p.innerRadius)],
			circleSegments(p.radius, coarse)
		);
		geometry.rotateZ(-Math.PI / 2);
		if (p.tilt) geometry.rotateZ(p.tilt);
		return at(vector(p.position), geometry, { outline: true, edgeAngle: 40 });
	}
	const shape = new THREE.Shape();
	shape.absarc(0, 0, p.radius, 0, Math.PI * 2, false);
	// innerRadius 0: solid disc (window pane).
	if (p.innerRadius > 0) {
		const hole = new THREE.Path();
		hole.absarc(0, 0, p.innerRadius, 0, Math.PI * 2, true);
		shape.holes.push(hole);
	}
	// Ellipse curves sample 2 × curveSegments points per full circle.
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: p.depth,
		bevelEnabled: false,
		curveSegments: circleSegments(p.radius, coarse) / 2
	});
	geometry.translate(0, 0, -p.depth / 2);
	geometry.rotateY(Math.PI / 2);
	// Axis along local x, tilted up by `tilt` before the turn in plan.
	if (p.tilt) geometry.rotateZ(p.tilt);
	return at(vector(p.position), geometry, { outline: true });
}

function buildCone(p: SolidOf<'cylinder' | 'cone'>, at: Placement, coarse: boolean) {
	const segments = circleSegments(p.radius, coarse);
	const diameter = p.radius * 2;
	const bevel = bevelRadius(p, Math.min(diameter, p.height), Math.max(diameter, p.height));
	const geometry =
		p.kind === 'cylinder' && bevel > 0
			? roundedDrum(p.radius, p.height, bevel, segments)
			: new THREE.CylinderGeometry(p.kind === 'cone' ? 0 : p.radius, p.radius, p.height, segments);
	return at(vector([p.position[0], p.position[1], p.position[2] + p.height / 2]), geometry, {
		outline: true
	});
}

function roundedDrum(radius: number, height: number, bevel: number, segments: number) {
	const half = height / 2;
	const profile = [new THREE.Vector2(0, -half)];
	for (const end of [-1, 1]) {
		for (let i = 0; i <= 3; i++) {
			const a = ((end < 0 ? i - 3 : i) * Math.PI) / 6;
			profile.push(
				new THREE.Vector2(
					radius - bevel + bevel * Math.cos(a),
					end * (half - bevel) + bevel * Math.sin(a)
				)
			);
		}
	}
	profile.push(new THREE.Vector2(0, half));
	return new THREE.LatheGeometry(profile, segments);
}

function buildSphere(p: SolidOf<'sphere'>, at: Placement, coarse: boolean) {
	const n = p.fine ? Math.max(64, kreisSegmente(p.radius, fein)) : circleSegments(p.radius, coarse);
	const geometry = new THREE.SphereGeometry(p.radius, n, n / 2);
	geometry.scale(1, p.squash ?? 1, 1);
	return at(vector(p.position), geometry, { outline: true });
}

function buildDome(p: SolidOf<'dome'>, at: Placement, coarse: boolean) {
	const rise = (p.height ?? p.radius) / p.radius;
	let geometry: THREE.BufferGeometry;
	if (p.facets) {
		// Geodesic: icosahedron, upper half kept, the cut ring flattened onto the base.
		const ico = new THREE.IcosahedronGeometry(p.radius, Math.round(p.facets));
		const src = ico.getAttribute('position');
		const keep: number[] = [];
		for (let i = 0; i < src.count; i += 3) {
			const cy = (src.getY(i) + src.getY(i + 1) + src.getY(i + 2)) / 3;
			if (cy <= 0) continue;
			for (let k = 0; k < 3; k++)
				keep.push(src.getX(i + k), Math.max(0, src.getY(i + k)), src.getZ(i + k));
		}
		ico.dispose();
		geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
		geometry.setAttribute(
			'uv',
			new THREE.Float32BufferAttribute(new Array((keep.length / 3) * 2).fill(0), 2)
		);
		geometry.computeVertexNormals();
	} else
		geometry = new THREE.SphereGeometry(
			p.radius,
			circleSegments(p.radius, coarse),
			circleSegments(p.radius, coarse) / 4,
			0,
			Math.PI * 2,
			0,
			Math.PI / 2
		);
	geometry.scale(1, rise, 1);
	return at(vector(p.position), geometry, {
		outline: true,
		edgeAngle: p.facets ? 1 : 46
	});
}

function buildCapsule(p: SolidOf<'capsule'>, at: Placement, coarse: boolean) {
	const a = vector(p.from),
		b = vector(p.to),
		dir = b.clone().sub(a),
		length = dir.length();
	const geometry = new THREE.CapsuleGeometry(
		p.radius,
		Math.max(0.001, length),
		circleSegments(p.radius, coarse) / 4,
		circleSegments(p.radius, coarse)
	);
	geometry.applyQuaternion(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			dir.normalize().lengthSq() ? dir : new THREE.Vector3(0, 1, 0)
		)
	);
	return at(a.add(b).multiplyScalar(0.5), geometry, { outline: true, rotation: 0 });
}

function buildWedge(p: SolidOf<'wedge'>, at: Placement) {
	const [w, d, h] = p.size,
		low = Math.max(0, Math.min(1, p.low ?? 0));
	const shape = new THREE.Shape([
		new THREE.Vector2(-w / 2, -h / 2),
		new THREE.Vector2(w / 2, -h / 2),
		new THREE.Vector2(w / 2, -h / 2 + low * h),
		new THREE.Vector2(-w / 2, h / 2)
	]);
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
	geometry.translate(0, 0, -d / 2);
	return at(
		vector([p.position[0] + w / 2, p.position[1] + d / 2, p.position[2] + h / 2]),
		geometry
	);
}

function buildHalfpipe(p: SolidOf<'arch' | 'vault' | 'halfpipe'>, at: Placement) {
	const w = p.width / 2,
		shape = new THREE.Shape();
	if (p.kind === 'arch') {
		const t = Math.min(p.thickness ?? w * 0.25, w * 0.6),
			r = w - t,
			spring = Math.max(0, p.rise - t - r);
		shape.moveTo(-w, 0);
		shape.lineTo(-r, 0);
		shape.lineTo(-r, spring);
		shape.absarc(0, spring, r, Math.PI, 0, true);
		shape.lineTo(r, 0);
		shape.lineTo(w, 0);
		shape.lineTo(w, Math.max(p.rise, spring + r + 0.05));
		shape.lineTo(-w, Math.max(p.rise, spring + r + 0.05));
	} else {
		const up = p.kind === 'vault',
			cy = up ? 0 : p.rise,
			t = p.thickness ?? (up ? 0 : Math.min(0.5, w * 0.2));
		const [a0, a1] = up ? [0, Math.PI] : [Math.PI, Math.PI * 2];
		shape.absellipse(0, cy, w, p.rise, a0, a1, false, 0);
		if (t > 0) shape.absellipse(0, cy, w - t, p.rise - t, a1, a0, true, 0);
	}
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: p.length,
		bevelEnabled: false,
		curveSegments: 32
	});
	geometry.translate(0, 0, -p.length / 2);
	// Profile spans local x; length runs along local y (three −z).
	return at(vector(p.position), geometry, {
		outline: p.kind === 'vault' && !p.thickness
	});
}

function buildFrame(p: SolidOf<'frame'>, at: Placement) {
	const [sx, sy, sz] = p.size,
		[nx, ny, nz] = p.cells.map((n) => Math.max(1, Math.round(n)));
	const bars: THREE.BufferGeometry[] = [];
	const z = new THREE.Vector3(0, 0, 1);
	const rulings: number[] = [];
	const bar = (a: Vec3, b: Vec3, thin = 1) => {
		const va = vector(a),
			vb = vector(b);
		rulings.push(...va.toArray(), ...vb.toArray());
		const dir = vb.clone().sub(va),
			len = dir.length();
		const g = new THREE.BoxGeometry(p.bar * thin, p.bar * thin, len);
		g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(z, dir.normalize()));
		g.translate(...va.add(vb).multiplyScalar(0.5).toArray());
		bars.push(g);
	};
	if (p.members) {
		for (const [a, b] of p.members) bar(a, b);
		const geometry = mergeGeometries(bars);
		for (const g of bars) g.dispose();
		return at(new THREE.Vector3(), geometry, { rotation: 0, edges: false, rulings });
	}
	const X = (i: number) => -sx / 2 + (sx * i) / nx,
		Y = (j: number) => -sy / 2 + (sy * j) / ny,
		Z = (k: number) => -sz / 2 + (sz * k) / nz,
		h = p.bar / 2;
	buildGrid();
	if (p.braced) braceGrid();
	const geometry = mergeGeometries(bars);
	for (const g of bars) g.dispose();
	return at(
		vector([p.position[0] + sx / 2, p.position[1] + sy / 2, p.position[2] + sz / 2]),
		geometry,
		{ edges: false, rulings }
	);

	function buildGrid() {
		for (let i = 0; i <= nx; i++)
			for (let j = 0; j <= ny; j++) bar([X(i), Y(j), -sz / 2], [X(i), Y(j), sz / 2]);
		for (let k = 0; k <= nz; k++) {
			for (let j = 0; j <= ny; j++) bar([-sx / 2 - h, Y(j), Z(k)], [sx / 2 + h, Y(j), Z(k)], 0.8);
			for (let i = 0; i <= nx; i++) bar([X(i), -sy / 2 - h, Z(k)], [X(i), sy / 2 + h, Z(k)], 0.8);
		}
	}

	function braceGrid() {
		for (let k = 0; k < nz; k++)
			for (let i = 0; i < nx; i++)
				for (const y of [-sy / 2, sy / 2])
					bar([X(i + ((i + k) % 2)), y, Z(k)], [X(i + 1 - ((i + k) % 2)), y, Z(k + 1)], 0.55);
	}
}

function buildTorus(p: SolidOf<'torus'>, at: Placement, coarse: boolean) {
	const arc = p.arc ?? Math.PI * 2;
	const geometry = new THREE.TorusGeometry(
		p.radius,
		p.tube,
		circleSegments(p.tube, coarse),
		Math.max(4, Math.ceil((circleSegments(p.radius, coarse) * arc) / (Math.PI * 2))),
		arc
	);
	if (p.axis === 'z') geometry.rotateX(-Math.PI / 2);
	return at(vector(p.position), geometry, { outline: true });
}

function buildHelix(p: SolidOf<'helix'>, at: Placement, coarse: boolean) {
	const steps = Math.max(12, Math.round(p.turns * pathSegments(64, coarse))),
		positions: number[] = [],
		index: number[] = [];
	// Four strips (top, bottom, outer, inner), each with own vertices → hard edges.
	const strip = (ra: number, za: number, rb: number, zb: number) => {
		const base = positions.length / 3;
		for (let i = 0; i <= steps; i++) {
			const a = (i / steps) * p.turns * Math.PI * 2,
				z = (i / steps) * (p.height - p.thickness);
			for (const [r, dz] of [
				[ra, za],
				[rb, zb]
			])
				positions.push(r * Math.cos(a), z + dz, -r * Math.sin(a));
		}
		for (let i = 0; i < steps; i++) {
			const q = base + i * 2;
			index.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
		}
	};
	const ri = p.innerRadius,
		ro = p.radius,
		t = p.thickness;
	strip(ri, t, ro, t);
	strip(ro, 0, ri, 0);
	strip(ro, t, ro, 0);
	strip(ri, 0, ri, t);
	const geometry = indexedPatch(positions, index);
	return at(vector(p.position), geometry, { double: true });
}

function buildMembrane(p: SolidOf<'membrane'>, at: Placement) {
	const [a, b, c, d] = p.corners.map(vector),
		n = 16,
		sag = p.sag ?? 0,
		positions: number[] = [],
		index: number[] = [],
		rulings: number[] = [];
	const point = (u: number, v: number) =>
		a
			.clone()
			.multiplyScalar((1 - u) * (1 - v))
			.add(b.clone().multiplyScalar(u * (1 - v)))
			.add(c.clone().multiplyScalar(u * v))
			.add(d.clone().multiplyScalar((1 - u) * v))
			.add(new THREE.Vector3(0, -sag * 16 * u * (1 - u) * v * (1 - v), 0));
	for (let j = 0; j <= n; j++)
		for (let i = 0; i <= n; i++) positions.push(...point(i / n, j / n).toArray());
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const q = j * (n + 1) + i;
			index.push(q, q + 1, q + n + 1, q + 1, q + n + 2, q + n + 1);
		}
	for (let k = 1; k < 4; k++)
		for (let i = 0; i < n; i++) {
			rulings.push(...point(k / 4, i / n).toArray(), ...point(k / 4, (i + 1) / n).toArray());
			rulings.push(...point(i / n, k / 4).toArray(), ...point((i + 1) / n, k / 4).toArray());
		}
	const geometry = indexedPatch(positions, index);
	return at(new THREE.Vector3(), geometry, { double: true, rotation: 0, rulings });
}

function indexedPatch(positions: number[], index: number[]) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute(
		'uv',
		new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)
	);
	geometry.setIndex(index);
	geometry.computeVertexNormals();
	return geometry;
}
