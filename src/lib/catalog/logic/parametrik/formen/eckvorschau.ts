/**
 * Test bench for eckModul without Astra's topology: single slots per mask class on a
 * square and a skewed quad, plus three small clusters on a slightly
 * distorted quad mesh (the three L10 scenes in miniature). Preview fixtures only.
 */
import type { CornerMask, Slot } from '../eck';
import type { ColorToken, Primitive, Role } from '../types';
import type { Point2 } from '../vocab';
import { random } from '../random';
import { eckModul, maskBits, maskName } from './eck';

export type SlotShape = 'quadrat' | 'schief';
export const slotShapes: { value: SlotShape; label: string }[] = [
	{ value: 'quadrat', label: 'Square' },
	{ value: 'schief', label: 'Skewed' }
];
const QUADS: Record<SlotShape, Slot['corners']> = {
	quadrat: [
		[-5, -5],
		[5, -5],
		[5, 5],
		[-5, 5]
	],
	schief: [
		[-5.8, -4.2],
		[5.2, -6],
		[4.2, 5.6],
		[-4.4, 3.8]
	]
};
/** One slot = two floors of 4 m each (lower and upper half). */
export const Z_HIGH = 8;

type Kontext = Partial<Slot['context']>;
export type MaskCase = { key: string; mask: CornerMask; title: string; context?: Kontext };

/** Two functions in one slot: corners 0–1 housing, 2–3 energy. */
const PAIR: ColorToken[] = ['--cat-business', '--cat-business', '--cat-mobility', '--cat-mobility'];

/** The mask classes of the three L10 scenes plus quiet fallbacks. */
export const maskCases: MaskCase[] = [
	{ key: 'voll', mask: 0xff, title: 'Full cell' },
	{ key: 'kante', mask: 0x33, title: 'Edge' },
	{ key: 'ecke', mask: 0x11, title: 'Corner' },
	{ key: 'innenecke', mask: 0x77, title: 'Inside corner' },
	{ key: 'diagonale', mask: 0x55, title: 'Diagonal' },
	{ key: 'sockel', mask: 0x0f, title: 'Bottom only' },
	{ key: 'ruecksprung', mask: 0x3f, title: 'Setback' },
	{ key: 'terrasse', mask: 0x7f, title: 'Terrace' },
	{ key: 'turm', mask: 0x13, title: 'Edge + corner above' },
	{ key: 'oben', mask: 0xf0, title: 'Top only', context: { ground: true } },
	{ key: 'auskragung', mask: 0xf3, title: 'Cantilever', context: { ground: true } },
	{ key: 'bruecke', mask: 0x30, title: 'Bridge', context: { span: true } },
	{ key: 'deck', mask: 0xf0, title: 'Bridge deck', context: { span: true } },
	{ key: 'hof', mask: 0x0e, title: 'Courtyard inside corner', context: { courtyard: true } },
	{ key: 'kopf', mask: 0xff, title: 'Full with crown', context: {} },
	{
		key: 'farben',
		mask: 0xf3,
		title: 'Two interventions',
		context: { tokens: [...PAIR, ...PAIR] }
	},
	{
		key: 'stuetzen',
		mask: 0xf3,
		title: 'Columns down to the ground',
		context: {
			stilts: [
				{ corner: 2, from: 0 },
				{ corner: 3, from: 0 }
			]
		}
	},
	{ key: 'bestand', mask: 0xff, title: 'Existing stock', context: { role: 'bestand' } },
	{ key: 'geruest', mask: 0xff, title: 'Structural frame', context: { frame: 0xff, hollow: 0xff } },
	{
		key: 'einschub',
		mask: 0xff,
		title: 'Frame with plug-in module',
		context: { frame: 0xff, hollow: 0xf0 }
	},
	{
		key: 'geruest-kante',
		mask: 0x37,
		title: 'Frame against a volume',
		context: { frame: 0x34, hollow: 0x34 }
	}
];

/** Seed that reliably produces a crown for the crown vignette (searched, deterministic). */
const KOPF_SEED = (() => {
	for (let s = 1; s < 500; s++) if (random(s ^ 0x9e3779b9)() < 0.3) return s;
	return 1;
})();

export function caseSlot(c: MaskCase, shape: SlotShape, seed = 7, token?: ColorToken): Slot {
	return {
		id: `${c.key}-${shape}`,
		corners: QUADS[shape],
		zLow: 0,
		zHigh: Z_HIGH,
		mask: c.mask,
		context: {
			neighborFilled: [false, false, false, false],
			openAbove: true,
			ground: true,
			courtyard: false,
			span: false,
			role: 'neu',
			token,
			...c.context
		},
		seed: c.key === 'kopf' ? KOPF_SEED : c.key === 'voll' ? KOPF_SEED + 1000 : seed
	};
}

/** Gray cage lines of the slot (bottom, top, edges) and dots for occupied corners. */
function cage(slot: Slot): Primitive[] {
	const at = (p: Point2, z: number): [number, number, number] => [p[0], p[1], z];
	const base = {
		role: 'bestand' as Role,
		token: '--paper' as const,
		material: 'concrete' as const
	};
	const out: Primitive[] = [
		{
			...base,
			id: 'kaefig-u',
			kind: 'polyline',
			points: slot.corners.map((p) => at(p, slot.zLow)),
			closed: true
		},
		{
			...base,
			id: 'kaefig-o',
			kind: 'polyline',
			points: slot.corners.map((p) => at(p, slot.zHigh)),
			closed: true
		}
	];
	slot.corners.forEach((p, i) =>
		out.push({
			...base,
			id: `kaefig-${i}`,
			kind: 'polyline',
			points: [at(p, slot.zLow), at(p, slot.zHigh)]
		})
	);
	return out;
}

export function caseScene(
	c: MaskCase,
	shape: SlotShape,
	seed?: number,
	token?: ColorToken
): Primitive[] {
	const slot = caseSlot(c, shape, seed, token);
	return [...cage(slot), ...eckModul(slot)];
}

export const caseLabel = (c: MaskCase) => `${c.title} · ${maskBits(c.mask)}`;
export const caseReason = (c: MaskCase) =>
	`${maskName(c.mask)} · bits 7…0 ${maskBits(c.mask)} (top | bottom)`;

/** Fixed camera for all single slots. */
export const slotView = { center: [0, 0, 4.5] as [number, number, number], span: 10.5 };

/* ── Clusters ────────────────────────────────────────────── */

/**
 * Mini patch: (n+1)² vertices, slightly distorted; occupancy per vertex and level 0/1.
 * Masks, neighbors and context are computed in a simplified way here (Astra does it properly).
 */
type Patch = {
	key: string;
	title: string;
	n: number;
	/** [x, y, level] of occupied build cells. */
	cells: [number, number, number][];
	bestand?: [number, number][];
	/** Vertices whose upper cell spans open space (bridge). */
	span?: [number, number][];
	/** Vertices that count as courtyard (free, closed, open above). */
	court?: [number, number][];
	/** Color of the intervention (function); without the field, ink. */
	token?: ColorToken;
};

export const patches: Patch[] = [
	{
		key: 'huelle',
		title: 'Shared envelope',
		n: 4,
		token: '--cat-living',
		cells: [
			[1, 1, 0],
			[2, 1, 0],
			[3, 1, 0],
			[1, 2, 0],
			[2, 2, 0],
			[1, 1, 1],
			[2, 1, 1],
			[1, 2, 1],
			[3, 3, 0]
		]
	},
	{
		key: 'hochweg',
		title: 'Elevated walkway at the existing stock',
		n: 5,
		token: '--cat-business',
		cells: [
			[1, 2, 0],
			[1, 2, 1],
			[1, 3, 0],
			[1, 3, 1],
			[4, 2, 0],
			[4, 2, 1],
			[2, 2, 1],
			[3, 2, 1]
		],
		bestand: [
			[1, 2],
			[1, 3]
		],
		span: [
			[2, 2],
			[3, 2]
		]
	},
	{
		key: 'hof',
		title: 'U → courtyard',
		n: 4,
		cells: [
			[1, 1, 0],
			[2, 1, 0],
			[3, 1, 0],
			[1, 2, 0],
			[3, 2, 0],
			[1, 3, 0],
			[2, 3, 0],
			[3, 3, 0],
			[3, 1, 1],
			[3, 2, 1],
			[3, 3, 1],
			[2, 3, 1],
			[1, 3, 1]
		],
		court: [[2, 2]]
	}
];

export function patchSlots(p: Patch, seed = 7, step = 9): Slot[] {
	const rng = random(seed);
	const v: Point2[][] = [];
	for (let x = 0; x <= p.n; x++) {
		v.push([]);
		for (let y = 0; y <= p.n; y++) {
			const edge = x === 0 || y === 0 || x === p.n || y === p.n;
			const j = edge ? 0.4 : 1.6;
			v[x].push([
				(x - p.n / 2) * step + (rng() - 0.5) * 2 * j,
				(y - p.n / 2) * step + (rng() - 0.5) * 2 * j
			]);
		}
	}
	const has = (x: number, y: number, l: number) =>
		p.cells.some(([a, b, c]) => a === x && b === y && c === l);
	const inList = (list: [number, number][] | undefined, x: number, y: number) =>
		!!list?.some(([a, b]) => a === x && b === y);
	const ids: [number, number][] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];
	const maskOf = (x: number, y: number) => {
		let m = 0;
		ids.forEach(([dx, dy], i) => {
			if (has(x + dx, y + dy, 0)) m |= 1 << i;
			if (has(x + dx, y + dy, 1)) m |= 1 << (i + 4);
		});
		return m;
	};
	const slots: Slot[] = [];
	for (let x = 0; x < p.n; x++)
		for (let y = 0; y < p.n; y++) {
			const corners = ids.map(([dx, dy]) => v[x + dx][y + dy]) as Slot['corners'];
			const mask = maskOf(x, y);
			// Side i borders the neighboring slot across corner i → i+1.
			const nb: [number, number][] = [
				[x, y - 1],
				[x + 1, y],
				[x, y + 1],
				[x - 1, y]
			];
			const neighborFilled = nb.map(
				([a, b]) => a >= 0 && b >= 0 && a < p.n && b < p.n && maskOf(a, b) !== 0
			) as [boolean, boolean, boolean, boolean];
			const at = ids.map(([dx, dy]) => [x + dx, y + dy] as [number, number]);
			slots.push({
				id: `${p.key}-${x}-${y}`,
				corners,
				zLow: 0,
				zHigh: Z_HIGH,
				mask,
				context: {
					neighborFilled,
					openAbove: true,
					ground: true,
					courtyard: at.some(([a, b]) => inList(p.court, a, b)),
					token: p.token,
					span: at.some(([a, b], i) => inList(p.span, a, b) && (mask >> (i + 4)) & 1),
					role:
						mask && at.every(([a, b], i) => !((mask >> i) & 17) || inList(p.bestand, a, b))
							? 'bestand'
							: 'neu',
					bestand: at.reduce((m, [a, b], i) => (inList(p.bestand, a, b) ? m | (17 << i) : m), 0)
				},
				seed: seed * 101 + x * 13 + y
			});
		}
	return slots;
}

/** Cluster: base grid gray, all corner modules. */
export function patchScene(p: Patch, seed = 7): Primitive[] {
	const slots = patchSlots(p, seed);
	const plan: Primitive[] = slots.map((s) => ({
		id: `${s.id}-raster`,
		kind: 'polyline',
		points: s.corners.map(([x, y]) => [x, y, 0]),
		closed: true,
		role: 'bestand',
		token: '--paper',
		material: 'concrete'
	}));
	return [...plan, ...slots.flatMap(eckModul)];
}

export const patchView = { center: [0, 0, 3] as [number, number, number], span: 21 };
