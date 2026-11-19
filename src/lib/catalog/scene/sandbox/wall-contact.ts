import {
	BufferGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Mesh,
	MeshBasicNodeMaterial
} from 'three/webgpu';
import type { TerrainGrid } from '../../logic/terrain-grid';
import { onFace, planarFaces, surveyGround } from '../../logic/structural-joints';
import { uv } from 'three/tsl';
import type { Primitive } from '../../logic/parametrik/types';

type Face = ReturnType<typeof planarFaces>[number];
const tolerance = 0.04;
const key = (z: number, up: number) => Math.floor(z / tolerance) + '/' + up;

function slabLevels(parts: Primitive[]) {
	const levels = new Map<string, Face[]>();
	for (const p of parts) {
		if (p.kind !== 'prism' || p.bearing !== 'slab' || p.overprint) continue;
		for (const face of planarFaces(p)) {
			const k = key(face.z, face.up);
			const bucket = levels.get(k);
			if (bucket) bucket.push(face);
			else levels.set(k, [face]);
		}
	}
	return levels;
}

function verticalFaces(p: Primitive) {
	if (p.overprint || p.planned || p.material === 'ghost') return [];
	const height = p.kind === 'box' ? p.size[2] : p.kind === 'prism' && !p.bearing ? p.height : 0;
	return height >= 0.7 ? planarFaces(p) : [];
}

type Band = (
	a: readonly number[],
	b: readonly number[],
	za: number,
	zb: number,
	rise: number
) => void;

function foundationBand(p: Extract<Primitive, { kind: 'prism' }>, grid: TerrainGrid, band: Band) {
	const ground = p.polygon.map(
		([x, y]) =>
			surveyGround(grid, { point: [x, y, p.z - 0.05], axis: [0, 0, 1], length: p.height + 0.1 })
				?.point[2]
	);
	p.polygon.forEach((a, i) => {
		const j = (i + 1) % p.polygon.length;
		const za = ground[i],
			zb = ground[j];
		if (za !== undefined && zb !== undefined)
			band(a, p.polygon[j], za, zb, Math.max(0, Math.min(0.5, p.z + p.height - Math.max(za, zb))));
	});
}

/** A 35 cm feather on the wall immediately above or below a touching slab. */
export function wallContact(parts: Primitive[], grid?: TerrainGrid) {
	const levels = slabLevels(parts);
	const positions: number[] = [],
		chart: number[] = [];
	function band(a: readonly number[], b: readonly number[], za: number, zb: number, rise: number) {
		for (const [q, z, fade] of [
			[a, za, 0],
			[b, zb, 0],
			[b, zb, 1],
			[a, za, 0],
			[b, zb, 1],
			[a, za, 1]
		] as const) {
			positions.push(q[0], z + rise * fade, -q[1]);
			chart.push(0, fade);
		}
	}
	for (const p of parts) {
		if (grid && p.kind === 'prism' && p.id.endsWith(':foot')) foundationBand(p, grid, band);
		for (const face of verticalFaces(p)) {
			const z = face.z,
				sign = -face.up;
			const touching = [-tolerance, 0, tolerance]
				.flatMap((offset) => levels.get(key(z + offset, sign)) ?? [])
				.filter((s) => Math.abs(s.z - z) < tolerance);
			if (!touching.length) continue;
			for (const ring of [face.ring, ...face.holes]) {
				ring.forEach((a, i) => {
					const b = ring[(i + 1) % ring.length];
					if (!touching.some((s) => onFace(s, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]))) return;
					band(a, b, z, z, sign * 0.35);
				});
			}
		}
	}
	if (!positions.length) return;
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(chart, 2));
	const material = new MeshBasicNodeMaterial({
		color: 0x403936,
		side: DoubleSide,
		transparent: true,
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -2
	});
	material.opacityNode = uv().y.oneMinus().pow(2).mul(0.5);
	return new Mesh(geometry, material);
}
