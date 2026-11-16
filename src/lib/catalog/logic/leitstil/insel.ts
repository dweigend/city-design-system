import type { BestandBlock, Segment, Vec3 } from './szene';
export function inselGeometrie(
	{ min: [x, y, z], max: [X, Y, Z] }: BestandBlock,
	abstandM: number
): { schraffur: Segment[]; punkte: Vec3[] } {
	const schraffur: Segment[] = [],
		punkte: Vec3[] = [];
	for (let a = x; a < X; a += 0.55)
		schraffur.push({ a: [a, y - 0.01, z], b: [Math.min(X, a + Z - z), y - 0.01, Z] });
	for (let a = y; a < Y; a += 0.55)
		schraffur.push({ a: [X + 0.01, a, z], b: [X + 0.01, Math.min(Y, a + Z - z), Z] });
	for (let a = x + 1; a < X; a += abstandM)
		for (let b = y + 1; b < Y; b += abstandM) punkte.push([a, b, Z + 0.015]);
	return { schraffur, punkte };
}
