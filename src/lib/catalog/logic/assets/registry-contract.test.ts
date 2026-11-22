import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type ObjectGeometry } from './index';
import type { Vec3 } from '../parametrik/types';

const FORBIDDEN_GEOMETRY_KEYS = [
	'token',
	'finish',
	'material',
	'overprint',
	'topToken',
	'printBand',
	'buildingSurface',
	'colourRole'
] as const;

const VALID_ROLES = new Set(['bestand', 'neu', 'traeger']);
const VALID_ATTACHMENTS = new Set(['facade', 'roof', 'deck']);
const BOUNDS_EPS_M = 1e-4;
const COLOUR_LITERAL_RE = /(#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/i;

type PlanBounds = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
};

function emptyBounds(): PlanBounds {
	return {
		minX: Infinity,
		maxX: -Infinity,
		minY: Infinity,
		maxY: -Infinity,
		minZ: Infinity,
		maxZ: -Infinity
	};
}

function includePoint(b: PlanBounds, x: number, y: number, z: number, rXY = 0, rZ = 0) {
	if (x - rXY < b.minX) b.minX = x - rXY;
	if (x + rXY > b.maxX) b.maxX = x + rXY;
	if (y - rXY < b.minY) b.minY = y - rXY;
	if (y + rXY > b.maxY) b.maxY = y + rXY;
	if (z - rZ < b.minZ) b.minZ = z - rZ;
	if (z + rZ > b.maxZ) b.maxZ = z + rZ;
}

function includeRotatedRect(
	b: PlanBounds,
	cx: number,
	cy: number,
	hx: number,
	hy: number,
	z0: number,
	z1: number,
	rotation = 0
) {
	const c = Math.cos(rotation);
	const s = Math.sin(rotation);
	const rx = Math.abs(hx * c) + Math.abs(hy * s);
	const ry = Math.abs(hx * s) + Math.abs(hy * c);
	includePoint(b, cx - rx, cy - ry, z0);
	includePoint(b, cx + rx, cy + ry, z1);
}

function geometryBounds(parts: readonly ObjectGeometry[]): PlanBounds {
	const b = emptyBounds();
	for (const p of parts) {
		const rot = p.rotation ?? 0;
		switch (p.kind) {
			case 'mesh':
				for (const [x, y, z] of p.points) includePoint(b, x, y, z);
				break;
			case 'polyline':
				for (const [x, y, z] of p.points) includePoint(b, x, y, z);
				break;
			case 'pipe': {
				const pts = p.points;
				if (pts.length === 1) {
					includePoint(b, pts[0][0], pts[0][1], pts[0][2], p.radius, p.radius);
					break;
				}
				for (let i = 0; i < pts.length - 1; i++) {
					const a = pts[i];
					const d = pts[i + 1];
					const dx = d[0] - a[0];
					const dy = d[1] - a[1];
					const dz = d[2] - a[2];
					const len = Math.hypot(dx, dy, dz);
					if (len <= 1e-12) continue;
					const tx = dx / len;
					const ty = dy / len;
					const tz = dz / len;
					const rx = p.radius * Math.sqrt(Math.max(0, 1 - tx * tx));
					const ry = p.radius * Math.sqrt(Math.max(0, 1 - ty * ty));
					const rz = p.radius * Math.sqrt(Math.max(0, 1 - tz * tz));
					includePoint(b, a[0] - rx, a[1] - ry, a[2] - rz);
					includePoint(b, a[0] + rx, a[1] + ry, a[2] + rz);
					includePoint(b, d[0] - rx, d[1] - ry, d[2] - rz);
					includePoint(b, d[0] + rx, d[1] + ry, d[2] + rz);
				}
				break;
			}
			case 'capsule':
				includePoint(b, p.from[0], p.from[1], p.from[2], p.radius, p.radius);
				includePoint(b, p.to[0], p.to[1], p.to[2], p.radius, p.radius);
				break;
			case 'membrane': {
				let memMinZ = Infinity;
				for (const [x, y, z] of p.corners) {
					includePoint(b, x, y, z);
					if (z < memMinZ) memMinZ = z;
				}
				if (p.sag && memMinZ - Math.max(0, p.sag) < b.minZ) {
					b.minZ = memMinZ - Math.max(0, p.sag);
				}
				break;
			}
			case 'prism': {
				const c = Math.cos(rot);
				const s = Math.sin(rot);
				for (const [px, py] of p.polygon) {
					const x = rot ? px * c - py * s : px;
					const y = rot ? px * s + py * c : py;
					includePoint(b, x, y, p.z);
					includePoint(b, x, y, p.z + p.height);
				}
				break;
			}
			case 'box':
			case 'wedge':
			case 'frame': {
				if (p.kind === 'frame' && p.members?.length) {
					for (const [a, d] of p.members) {
						includePoint(b, a[0], a[1], a[2], p.bar / 2, p.bar / 2);
						includePoint(b, d[0], d[1], d[2], p.bar / 2, p.bar / 2);
					}
				} else {
					const [x, y, z] = p.position;
					const [w, d, h] = p.size;
					includeRotatedRect(b, x + w / 2, y + d / 2, w / 2, d / 2, z, z + h, rot);
				}
				break;
			}
			case 'cylinder':
			case 'cone':
			case 'helix':
				includePoint(b, p.position[0], p.position[1], p.position[2], p.radius, 0);
				includePoint(b, p.position[0], p.position[1], p.position[2] + p.height, p.radius, 0);
				break;
			case 'sphere': {
				const rz = p.radius * (p.squash ?? 1);
				includePoint(b, p.position[0], p.position[1], p.position[2], p.radius, rz);
				break;
			}
			case 'dome':
				includePoint(b, p.position[0], p.position[1], p.position[2], p.radius, 0);
				includePoint(
					b,
					p.position[0],
					p.position[1],
					p.position[2] + (p.height ?? p.radius),
					p.radius,
					0
				);
				break;
			case 'ring': {
				const tilt = p.tilt ?? 0;
				const halfDepth = p.depth / 2;
				const hx = Math.abs(halfDepth * Math.cos(tilt)) + Math.abs(p.radius * Math.sin(tilt));
				const hy = p.radius;
				const hz = Math.abs(p.radius * Math.cos(tilt)) + Math.abs(halfDepth * Math.sin(tilt));
				includeRotatedRect(
					b,
					p.position[0],
					p.position[1],
					hx,
					hy,
					p.position[2] - hz,
					p.position[2] + hz,
					rot
				);
				break;
			}
			case 'torus': {
				const r = p.radius + p.tube;
				if (p.axis === 'x') {
					includeRotatedRect(
						b,
						p.position[0],
						p.position[1],
						p.tube,
						r,
						p.position[2] - r,
						p.position[2] + r,
						rot
					);
				} else {
					includePoint(b, p.position[0], p.position[1], p.position[2], r, p.tube);
				}
				break;
			}
			case 'arch':
			case 'vault':
			case 'halfpipe':
				includeRotatedRect(
					b,
					p.position[0],
					p.position[1],
					p.width / 2,
					p.length / 2,
					p.position[2],
					p.position[2] + p.rise,
					rot
				);
				break;
		}
	}
	return b;
}

function isUnitVector([x, y, z]: Vec3) {
	return Math.abs(Math.hypot(x, y, z) - 1) <= 1e-6;
}

test('assetRegistry exposes unique IDs including site-parametric ribbon-segment', () => {
	expect(assetRegistry.length).toBeGreaterThan(0);
	const ids = assetRegistry.map((e) => e.id);
	expect(new Set(ids).size).toBe(ids.length);
	const ribbon = assetRegistry.find((e) => e.id === 'ribbon-segment');
	expect(ribbon?.siteParametric).toBe(true);
});

test('every registered object satisfies the shared role, footprint, anchor and colour-free contract', () => {
	const seeds = [0, 7] as const;

	for (const entry of assetRegistry) {
		expect(entry.variants.length).toBeGreaterThanOrEqual(1);
		expect(new Set(entry.variants).size).toBe(entry.variants.length);
		expect(entry.slotNames.length).toBeGreaterThanOrEqual(1);
		expect(new Set(entry.slotNames).size).toBe(entry.slotNames.length);

		const [fx, fy] = entry.footprint;
		expect(Number.isFinite(fx) && fx > 0).toBe(true);
		expect(Number.isFinite(fy) && fy > 0).toBe(true);

		expect(entry.anchors.length).toBeGreaterThanOrEqual(1);
		const isFacade = entry.anchors.some((a) => a.attachment === 'facade');
		for (const anchor of entry.anchors) {
			expect(VALID_ATTACHMENTS.has(anchor.attachment)).toBe(true);
			expect(anchor.position).toEqual([0, 0, 0]);
			expect(isUnitVector(anchor.normal)).toBe(true);
			expect(anchor.normal).toEqual(anchor.attachment === 'facade' ? [1, 0, 0] : [0, 0, 1]);
		}

		const slotSet = new Set(entry.slotNames);
		const minAllowedX = (isFacade ? 0 : -fx / 2) - BOUNDS_EPS_M;
		const maxAllowedX = (isFacade ? fx : fx / 2) + BOUNDS_EPS_M;
		const minAllowedY = -fy / 2 - BOUNDS_EPS_M;
		const maxAllowedY = fy / 2 + BOUNDS_EPS_M;

		for (const variant of entry.variants) {
			const defaults = entry.slotDefaults[variant];
			expect(defaults).toBeDefined();
			for (const slot of entry.slotNames) {
				expect(defaults[slot]).toBeDefined();
				expect(typeof defaults[slot].finish).toBe('string');
				expect(typeof defaults[slot].token).toBe('string');
				expect(typeof defaults[slot].material).toBe('string');
			}

			for (const seed of seeds) {
				const built = buildObject(entry.id, variant, seed);
				expect(built.footprint).toEqual(entry.footprint);
				expect(built.anchors).toEqual([...entry.anchors]);
				expect(built.geometry.length).toBeGreaterThan(0);
				expect(built.parts).toHaveLength(built.geometry.length);

				const partIds = new Set<string>();
				for (let i = 0; i < built.geometry.length; i++) {
					const geo = built.geometry[i];
					const part = built.parts[i];
					expect(partIds.has(geo.id)).toBe(false);
					partIds.add(geo.id);
					expect(slotSet.has(geo.slot)).toBe(true);
					expect(VALID_ROLES.has(geo.role)).toBe(true);
					expect(VALID_ROLES.has(part.role)).toBe(true);
					expect(typeof part.material).toBe('string');

					for (const forbidden of FORBIDDEN_GEOMETRY_KEYS) {
						expect(forbidden in geo).toBe(false);
					}
					expect(COLOUR_LITERAL_RE.test(JSON.stringify(geo))).toBe(false);
				}

				const b = geometryBounds(built.geometry);
				expect(b.minX).toBeGreaterThanOrEqual(minAllowedX);
				expect(b.maxX).toBeLessThanOrEqual(maxAllowedX);
				expect(b.minY).toBeGreaterThanOrEqual(minAllowedY);
				expect(b.maxY).toBeLessThanOrEqual(maxAllowedY);
				expect(b.minZ).toBeGreaterThanOrEqual(-BOUNDS_EPS_M);
			}
		}
	}
});

test('site-parametric ribbon-segment keeps colour-free geometry, enclosing footprint and outward anchors', () => {
	const sections = [
		{ centre: [0, 0, 3] as Vec3, left: [0, 0.9, 3] as Vec3, right: [0, -0.9, 3] as Vec3 },
		{ centre: [6, 0, 3] as Vec3, left: [6, 0.9, 3] as Vec3, right: [6, -0.9, 3] as Vec3 }
	];
	for (const variant of ['supported', 'paired', 'tunnel'] as const) {
		const built = buildObject('ribbon-segment', variant, 7, {
			instanceId: 'contract/' + variant,
			site: { sections, ground: () => 0 }
		});
		const b = geometryBounds(built.geometry);
		expect(built.footprint[0]).toBeCloseTo(b.maxX - b.minX, 6);
		expect(built.footprint[1]).toBeCloseTo(b.maxY - b.minY, 6);
		expect(built.anchors).toHaveLength(2);
		for (const anchor of built.anchors) {
			expect(isUnitVector(anchor.normal)).toBe(true);
		}
		// Start anchor points -x, end anchor points +x (strictly outward from [0..6]).
		expect(built.anchors[0].normal[0]).toBeCloseTo(-1, 6);
		expect(built.anchors[1].normal[0]).toBeCloseTo(1, 6);
		for (const geo of built.geometry) {
			for (const forbidden of FORBIDDEN_GEOMETRY_KEYS) {
				expect(forbidden in geo).toBe(false);
			}
		}
	}
});
