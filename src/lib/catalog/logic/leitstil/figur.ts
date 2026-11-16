import type { Segment, Vec3 } from './szene';
/** Figure in meters, z up; exactly 1.8 m including the head. */
export function figurSegmente([x, y, z]: Vec3): Segment[] {
	const s: Segment[] = [
		{ a: [x, y, z + 0.65], b: [x, y, z + 1.45] },
		{ a: [x, y, z + 0.8], b: [x - 0.18, y, z] },
		{ a: [x, y, z + 0.8], b: [x + 0.18, y, z] },
		{ a: [x - 0.17, y, z + 0.82], b: [x, y, z + 1.35] },
		{ a: [x, y, z + 1.35], b: [x + 0.17, y, z + 0.82] }
	];
	for (let i = 0; i < 16; i++) {
		const a = (i * Math.PI) / 8,
			b = ((i + 1) * Math.PI) / 8;
		s.push({
			a: [x + Math.cos(a) * 0.15, y, z + 1.65 + Math.sin(a) * 0.15],
			b: [x + Math.cos(b) * 0.15, y, z + 1.65 + Math.sin(b) * 0.15]
		});
	}
	return s;
}
