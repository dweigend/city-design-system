import { box, clamp, count, shiftZ, type Primitive, type ColorToken } from './types';
import { random } from './random';
export type StackParams = { floors: number; offset: number; explosion: number; seed: number };
/** Meter grid port of the Blender ensemble. Ranks are independent of presentation. */
export function stack({ floors, offset, explosion, seed }: StackParams): Primitive[] {
	const n = count(floors, 2, 10),
		e = clamp(explosion, 0, 1),
		s = clamp(offset, 0, 4),
		rng = random(seed);
	const out: Primitive[] = [];
	function add(p: Primitive, rank = 0, stretchRank?: number) {
		out.push({ ...p, rank, stretchRank });
	}
	for (const [x, w] of [
		[0, 20],
		[35, 15]
	]) {
		add(box(`existing-${x}`, [x, 0, 0], [w, 15, 20], '--paper', 'bestand'), -1);
		for (const [z, h, over] of [
			[0, 0.8, 0.15],
			[3.9, 0.28, 0.12],
			[19.4, 0.6, 0.4]
		])
			add(
				box(
					`cornice-${x}-${z}`,
					[x - over, -over, z],
					[w + over * 2, 15 + over * 2, h],
					'--paper',
					'bestand'
				),
				-1
			);
		for (let k = 0; k < 5; k++) {
			const pitch = 2.4 + rng() * 0.2;
			for (let a = 1.2; a < w - 0.6; a += pitch)
				for (const y of [-0.045, 15])
					add(
						{
							...box(
								`window-${x}-${k}-${a}-${y}`,
								[x + a - 0.6, y, k * 4 + 1],
								[1.2, 0.045, 2.3],
								'--paper',
								'bestand'
							),
							detail: true,
							shade: 0.22
						},
						-1
					);
			const side = x === 0 ? x - 0.045 : x + w;
			for (let a = 1.2; a < 15; a += 2.5)
				add(
					{
						...box(
							`side-window-${x}-${k}-${a}`,
							[side, a - 0.6, k * 4 + 1],
							[0.045, 1.2, 2.3],
							'--paper',
							'bestand'
						),
						detail: true,
						shade: 0.22
					},
					-1
				);
		}
		for (const cx of [x + 2, x + w - 3])
			add(box(`chimney-${cx}`, [cx, 12, 20], [0.8, 0.8, 1.6], '--paper', 'bestand'), -1);
	}
	add({ ...box('core', [25.4, 5.4, 0], [4.2, 4.2, n * 4 + 2.8], '--paper'), shade: 0.16 }, 0, n);
	const tokens: ColorToken[] = [
		'--cat-business',
		'--cat-business',
		'--cat-business',
		'--cat-business',
		'--cat-health',
		'--cat-nature',
		'--cat-business',
		'--cat-nature'
	];
	for (let k = 0; k <= n; k++) {
		const dx = k >= 5 ? Math.round(rng() * 2 - 1) * s * 2 : 0,
			dy = Math.round(rng()) * s;
		add(
			{
				...box(`deck-${k}`, [20 + dx, dy, k * 4], [15, 15, 0.4], '--paper'),
				pattern: k === n ? 'schachbrett-tinte' : undefined
			},
			k
		);
		if (k === n) break;
		// Four perimeter bays leave an uninterrupted, visible core.
		const bays = [
			[20.3, 1, 4.4, 4.4],
			[30.3, 7, 4.4, 7.4],
			[25.3, -1.5 - s, 4.4, 4.4],
			[20.3, 10.3, 4.4, 4.4]
		];
		for (let j = 0; j < 3; j++) {
			const b = bays[(j + k) % 4],
				slide = k >= 5 ? (j === 0 ? -s * 2 : s * 1.4) : 0;
			add(
				{
					...box(
						`module-${k}-${j}`,
						[b[0] + (k >= 5 ? dx + slide : 0), b[1] + dy, k * 4 + 0.4],
						[b[2], b[3], 3.3],
						tokens[k % 8],
						'neu',
						k % 2 ? 'wood' : 'metal'
					),
					pattern: k === 4 ? 'streifen-tinte-diagonal' : undefined
				},
				k
			);
		}
		// Two stair flights, with fixed risers; explosion opens a gap between stories.
		for (let h = 0; h < 2; h++)
			for (let t = 0; t < 10; t++)
				add(
					{
						...box(
							`stair-${k}-${h}-${t}`,
							[20.5 + (h === 0 ? t : 9 - t) * 0.3, -1.8, k * 4 + h * 2 + t * 0.2],
							[0.32, 1.4, 0.18],
							'--paper',
							'neu',
							'metal'
						),
						edges: false
					},
					k
				);
		for (let h = 1; h <= 2; h++)
			add(
				box(
					`landing-${k}-${h}`,
					[h === 1 ? 23.5 : 19.8, -1.8, k * 4 + h * 2 - 0.2],
					[1, 1.4, 0.2],
					'--paper',
					'neu',
					'metal'
				),
				k
			);
	}
	for (const x of [20.2, 24.4])
		for (const y of [-1.9, -0.3])
			add(
				box(`post-${x}-${y}`, [x, y, 0], [0.14, 0.14, n * 4 + 1], '--paper', 'neu', 'metal'),
				0,
				n
			);
	const roof = n * 4 + 0.4;
	add(
		{
			id: 'silo',
			kind: 'cylinder',
			position: [32, 8, roof],
			radius: 2.3,
			height: 5,
			role: 'neu',
			token: '--cat-health',
			material: 'metal',
			pattern: 'punkte-tinte'
		},
		n
	);
	add(
		{
			id: 'cone',
			kind: 'cone',
			position: [32, 8, roof + 5],
			radius: 2.55,
			height: 3,
			role: 'neu',
			token: '--signal',
			material: 'metal'
		},
		n
	);
	const kb = Math.min(6, n - 1);
	add(
		{
			...box('bridge', [3, 6, kb * 4 + 0.4], [18, 3, 2.8], '--cat-business', 'neu', 'wood'),
			pattern: 'streifen-rot'
		},
		kb
	);
	add(
		{
			id: 'ring',
			kind: 'ring',
			position: [8, 7.5, kb * 4 + 1.8],
			radius: 5,
			innerRadius: 3.6,
			depth: 1.6,
			role: 'neu',
			token: '--signal',
			material: 'metal'
		},
		kb
	);
	for (let i = 0; i < 3; i++)
		add(
			{
				id: `pipe-${i}`,
				kind: 'pipe',
				points: [
					[31 + i * 0.95, 6, roof + 1.6],
					[31 + i * 0.95, 0, roof + 1.6],
					[31 + i * 0.95, -0.8, roof + 0.8],
					[31 + i * 0.95, -0.8, 1],
					[31 + i * 0.95, -2.5, 1]
				],
				radius: 0.32,
				role: 'neu',
				token: (['--blueprint', '--cat-mobility', '--cat-health'] as const)[i],
				material: 'metal'
			},
			0,
			n
		);
	add(box('distributor', [30, -3.4, 0], [4, 1.4, 1.8], '--paper', 'neu', 'metal'));
	return out.map((p) => {
		const dz = e * 4 * Math.max(0, p.rank ?? 0),
			stretch = e * 4 * (p.stretchRank ?? 0);
		if (p.kind === 'pipe')
			return {
				...p,
				points: p.points.map(([x, y, z]) => [
					x,
					y,
					z + stretch * Math.min(1, Math.max(0, (z - 1) / (roof + 0.6)))
				])
			};
		if (p.kind === 'box')
			return {
				...p,
				position: [p.position[0], p.position[1], p.position[2] + dz],
				size: [p.size[0], p.size[1], p.size[2] + stretch]
			};
		return shiftZ(p, dz);
	});
}
