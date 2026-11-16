import type { BestandBlock, Segment, Vec3 } from './szene';
export function bestandSegmente(block: BestandBlock): Segment[] {
	const [x, y, z] = block.min,
		[X, Y, Z] = block.max;
	const s: Segment[] = [];
	const line = (a: Vec3, b: Vec3, art: Segment['art'] = 'kante') => s.push({ a, b, art });
	for (const h of [z, Z]) {
		line([x - 0.35, y, h], [X + 0.35, y, h]);
		line([x - 0.35, Y, h], [X + 0.35, Y, h]);
		line([x, y - 0.35, h], [x, Y + 0.35, h]);
		line([X, y - 0.35, h], [X, Y + 0.35, h]);
	}
	for (const a of [x, X]) for (const b of [y, Y]) line([a, b, z - 0.35], [a, b, Z + 0.35]);
	for (const h of [4, 8])
		if (h >= z && h <= Z) {
			line([x - 0.35, y - 0.02, h], [X + 0.35, y - 0.02, h], 'gesims');
			line([X + 0.02, y - 0.35, h], [X + 0.02, Y + 0.35, h], 'gesims');
		}
	for (let a = x + 1.4; a < X - 1; a += 2.5)
		for (const h of [1, 4.8, 6.4]) {
			const w = 0.9,
				top = h + 1.1;
			line([a, y - 0.025, h], [a, y - 0.025, top], 'fenster');
			line([a + w, y - 0.025, h], [a + w, y - 0.025, top], 'fenster');
			line([a, y - 0.025, top], [a + w, y - 0.025, top], 'fenster');
			line([a, y - 0.025, h], [a + w, y - 0.025, h], 'fenster');
			if (h === 1)
				for (let i = 0; i < 12; i++) {
					const t = (i * Math.PI) / 12,
						u = ((i + 1) * Math.PI) / 12;
					line(
						[a + w / 2 + (Math.cos(t) * w) / 2, y - 0.03, top + (Math.sin(t) * w) / 2],
						[a + w / 2 + (Math.cos(u) * w) / 2, y - 0.03, top + (Math.sin(u) * w) / 2],
						'bogen'
					);
				}
		}
	for (let b = y + 1.4; b < Y - 1; b += 2.5)
		for (const h of [1, 4.8, 6.4]) {
			line([X + 0.025, b, h], [X + 0.025, b, h + 1.1], 'fenster');
			line([X + 0.025, b + 0.9, h], [X + 0.025, b + 0.9, h + 1.1], 'fenster');
			line([X + 0.025, b, h + 1.1], [X + 0.025, b + 0.9, h + 1.1], 'fenster');
		}
	return s;
}
