import type { Vec3 } from '../../parametrik/types';
import { surface, ring } from '../parts';
import { panel } from '../objects/forms';
type Section = { centre: Vec3; radius: number };
const count = 48;
function skin(sections: Section[]) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const [
		k,
		{
			centre: [x, y, z],
			radius
		}
	] of sections.entries()) {
		for (let i = 0; i < count; i++) {
			const a = (i * 2 * Math.PI) / count;
			points.push([x, y + radius * Math.cos(a), z + radius * Math.sin(a)]);
			if (k === 0) continue;
			const j = (i + 1) % count,
				start = (k - 1) * count,
				end = k * count;
			triangles.push(start + i, start + j, end + i, start + j, end + j, end + i);
		}
	}
	const end = (sections.length - 1) * count;
	for (let i = 1; i < count - 1; i++) triangles.push(0, i + 1, i, end, end + i, end + i + 1);
	return { ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] };
}
function endProfile(
	[x, y, z]: Vec3,
	r: number,
	from: number,
	to: number,
	steps: number
): Section[] {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const angle = from + ((to - from) * i) / steps;
		return { centre: [x + r * Math.sin(angle), y, z] as Vec3, radius: r * Math.cos(angle) };
	});
}
/** Hollow capsule with a turned window jamb, recessed acrylic disc and a built-in window seat. */
export function portShell(rear: Vec3, front: Vec3, r: number) {
	const aperture = Math.acos(0.7),
		[x, y, z] = front,
		lip = x + r * Math.sin(aperture);
	const sections = [
		...endProfile(rear, r, -Math.PI / 2 + 0.025, 0, 12),
		...endProfile(front, r, 0, aperture, 8)
	];
	const inside = [
		...endProfile(rear, r - 0.14, -Math.PI / 2 + 0.025, 0, 12),
		...endProfile(front, r - 0.14, 0, aperture, 8)
	].reverse();
	return [
		skin([...sections, ...inside]),
		ring([lip - 0.045, y, z], r * 0.714, r * 0.6, 0.22, 'foot'),
		ring([lip - 0.145, y, z], r * 0.61, 0, 0.08, 'glass'),
		panel(x - 0.13, y, z - r * 0.26, 0.62, r * 1.16, 0.17, 'foot')
	];
}
