import { box, clamp, count, type Primitive, type Vec3 } from './types';
import { random } from './random';
export function plugin({
	size,
	occupancy,
	seed
}: {
	size: number;
	occupancy: number;
	seed: number;
}): Primitive[] {
	const n = count(size, 2, 7),
		rng = random(seed),
		ports: { id: string; position: Vec3 }[] = [];
	const out: Primitive[] = [];
	for (let x = 0; x <= n; x++)
		for (const y of [-3, 3])
			out.push(
				box(
					`post-${x}-${y}`,
					[x * 5 - n * 2.5, y, 0],
					[0.25, 0.25, n * 4],
					'--paper',
					'bestand',
					'metal'
				)
			);
	for (let k = 0; k < n; k++) {
		out.push(
			box(`deck-${k}`, [-n * 2.5, -3, k * 4], [n * 5, 6.25, 0.25], '--paper', 'bestand', 'metal')
		);
		for (let x = 0; x < n; x++)
			ports.push({ id: `port-${k}-${x}`, position: [x * 5 - n * 2.5 + 0.5, -2.5, k * 4 + 0.25] });
	}
	// Fisher–Yates: a deterministic permutation; each port can be used once.
	for (let i = ports.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[ports[i], ports[j]] = [ports[j], ports[i]];
	}
	const occupied = Math.round(ports.length * clamp(occupancy, 0, 1));
	ports.forEach((p, i) =>
		out.push(
			i < occupied
				? box(p.id, p.position, [4, 5, 3.2], '--cat-business', 'neu', 'wood')
				: box(
						p.id,
						[p.position[0], p.position[1], p.position[2] + 0.02],
						[4, 5, 0.08],
						'--paper',
						'bestand',
						'metal'
					)
		)
	);
	return out;
}
