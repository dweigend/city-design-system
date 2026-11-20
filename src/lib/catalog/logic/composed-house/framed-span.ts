import { plotCovers } from '../parzelle';
import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { textileBay } from './textile-frame';

type Shell = NonNullable<HouseComposition['exterior']>;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const radius = 0.085;
const margin = radius / Math.cos(Math.PI / 12) + 0.005;

function survey(h: HouseComposition, shell: Shell, index: number, start: number, end: number) {
	const a = shell.ring[index],
		b = shell.ring[(index + 1) % shell.ring.length];
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const x = (b[0] - a[0]) / length,
		y = (b[1] - a[1]) / length;
	const width = (end - start) * length;
	const xy = (u: number, d: number): [number, number] => [
		a[0] + x * (start * length + u) - y * d,
		a[1] + y * (start * length + u) + x * d
	];
	// Certify the entire carrier including the circular stock at both ends and its free fabric.
	for (const trim of [margin * 2, width * 0.12, width * 0.25]) {
		for (const factor of [1, 0.5, 0.22, 0.09]) {
			const depth = Math.min(3, width * 0.25) * factor;
			if (width - 2 * trim < 0.2 || depth < 2 * margin) continue;
			const ring = [
				xy(trim - margin, 0),
				xy(width - trim + margin, 0),
				xy(width - trim + margin, depth + 2 * margin),
				xy(trim - margin, depth + 2 * margin)
			];
			if (plotCovers(h.cells, { ring, holes: [] }, 0)) return { xy, x, y, width, trim, depth };
		}
	}
}

type Survey = NonNullable<ReturnType<typeof survey>>;
function fitBay(
	s: Survey,
	frame: NonNullable<Shell['frame']>,
	fabric: NonNullable<Shell['fabric']>,
	bottom: number,
	top: number,
	start: number,
	width: number
) {
	const height = top - bottom,
		origin = s.xy(start, 0);
	const place = (u: number, d: number, v: number): Vec3 => [
		...s.xy(start + u * width, margin + (1 - d) * s.depth),
		bottom + height * v
	];
	const confine = ([x, y, z]: Vec3): Vec3 => {
		const dx = x - origin[0],
			dy = y - origin[1];
		const u = clamp(dx * s.x + dy * s.y, 0, width),
			d = clamp(-dx * s.y + dy * s.x, 0, s.depth + 2 * margin);
		return [...s.xy(start + u, d), clamp(z, bottom, top)];
	};
	return textileBay(frame, fabric, place, confine);
}

/** Finds space inside a surveyed wall for feet, projecting rods and the membranes they carry. */
export function framedSpan(
	h: HouseComposition,
	shell: Shell,
	index: number,
	start: number,
	end: number,
	hidden?: readonly number[]
) {
	if (!shell.frame || !shell.fabric) return;
	const s = survey(h, shell, index, start, end);
	if (!s) return;
	const ranges = hidden
		? [
				[shell.bottom, hidden[0]],
				[hidden[1], shell.top]
			]
		: [[shell.bottom, shell.top]];
	const points: Vec3[] = [],
		triangles: number[] = [],
		rods: [Vec3, Vec3][] = [];
	for (const [bottom, top] of ranges) {
		if (top - bottom < 0.2) continue;
		const width = s.width - 2 * s.trim;
		const bays = Math.max(1, Math.round(width / Math.max(7, (top - bottom) * 0.95)));
		for (let i = 0; i < bays; i++) {
			const span = fitBay(
				s,
				shell.frame,
				shell.fabric,
				bottom,
				top,
				s.trim + (i * width) / bays,
				width / bays
			);
			const base = points.length;
			points.push(...span.points);
			triangles.push(...span.triangles.map((n) => base + n));
			rods.push(...span.rods);
		}
	}
	return { points, triangles, rods };
}
