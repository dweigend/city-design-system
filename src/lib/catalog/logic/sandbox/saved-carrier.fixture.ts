import { install } from './installation';
import { withState, type World } from './world';
import type { Anchor, Installation } from './installation-parts';

// Historical installed wall seats used by the docking, picking and saved-stock regressions.
const frames: Record<
	string,
	{ seats: Anchor[]; rods: ['bearing' | 'chord' | 'brace', number, number | null][] }
> = {
	'90/40': {
		seats: [
			{ cellId: '90/40', level: 3, face: 0, lift: 0, inset: 0.25782075661247816 },
			{ cellId: '90/40', level: 3, face: 0, lift: 6, inset: 0.25782075661247816 },
			{ cellId: '91/40', level: 2, face: 1, lift: 0, inset: 0.25782075661247816 },
			{ cellId: '91/40', level: 2, face: 1, lift: 10, inset: 0.25782075661247816 },
			{ cellId: '94/40', level: 3, face: 0, lift: 0, inset: 0.22101533145705152 },
			{ cellId: '94/40', level: 3, face: 0, lift: 6, inset: 0.22101533145705152 },
			{ cellId: '90/40', level: 3, face: 3, lift: 0, inset: 0.25782075661247816 },
			{ cellId: '94/40', level: 3, face: 3, lift: 0, inset: 0.22101533145705152 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 0, 3],
			['bearing', 4, null],
			['chord', 4, 5],
			['chord', 3, 5],
			['brace', 6, 3],
			['bearing', 6, null],
			['brace', 6, 1],
			['bearing', 7, null],
			['brace', 7, 5]
		]
	},
	'83/47': {
		seats: [
			{ cellId: '83/47', level: 2, face: 1, lift: 0, inset: 0.26957083506344215 },
			{ cellId: '83/47', level: 2, face: 1, lift: 10, inset: 0.26957083506344215 },
			{ cellId: '86/47', level: 3, face: 1, lift: 0, inset: 0.42240203333905574 },
			{ cellId: '86/47', level: 3, face: 1, lift: 6, inset: 0.42240203333905574 },
			{ cellId: '87/47', level: 2, face: 2, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '87/47', level: 2, face: 1, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '87/47', level: 2, face: 1, lift: 10, inset: 0.21905117950475061 },
			{ cellId: '83/47', level: 2, face: 2, lift: 0, inset: 0.26957083506344215 },
			{ cellId: '86/47', level: 3, face: 2, lift: 0, inset: 0.42240203333905574 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 4, 3],
			['bearing', 5, null],
			['chord', 5, 6],
			['chord', 3, 6],
			['brace', 2, 6],
			['bearing', 7, null],
			['brace', 7, 1],
			['bearing', 8, null],
			['brace', 8, 3],
			['bearing', 4, null],
			['brace', 4, 6]
		]
	},
	'82/46': {
		seats: [
			{ cellId: '82/46', level: 3, face: 1, lift: 0, inset: 0.3929716096650657 },
			{ cellId: '82/46', level: 3, face: 1, lift: 6, inset: 0.3929716096650657 },
			{ cellId: '83/46', level: 2, face: 1, lift: 0, inset: 0.26957083506344215 },
			{ cellId: '83/46', level: 2, face: 1, lift: 10, inset: 0.26957083506344215 },
			{ cellId: '86/45', level: 3, face: 2, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '86/45', level: 3, face: 2, lift: 6, inset: 0.21905117950475061 },
			{ cellId: '82/46', level: 3, face: 0, lift: 0, inset: 0.3929716096650657 },
			{ cellId: '86/44', level: 3, face: 3, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '86/44', level: 3, face: 3, lift: 6, inset: 0.21905117950475061 },
			{ cellId: '87/44', level: 3, face: 1, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '87/44', level: 3, face: 1, lift: 6, inset: 0.21905117950475061 },
			{ cellId: '83/46', level: 2, face: 0, lift: 0, inset: 0.26957083506344215 },
			{ cellId: '86/45', level: 3, face: 3, lift: 0, inset: 0.21905117950475061 },
			{ cellId: '87/44', level: 3, face: 2, lift: 0, inset: 0.21905117950475061 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 0, 3],
			['bearing', 4, null],
			['chord', 4, 5],
			['chord', 3, 5],
			['brace', 6, 3],
			['bearing', 7, null],
			['chord', 7, 8],
			['chord', 5, 8],
			['brace', 4, 8],
			['bearing', 9, null],
			['chord', 9, 10],
			['chord', 8, 10],
			['brace', 7, 10],
			['bearing', 6, null],
			['brace', 6, 1],
			['bearing', 11, null],
			['brace', 11, 3],
			['bearing', 12, null],
			['brace', 12, 5],
			['bearing', 13, null],
			['brace', 13, 10]
		]
	},
	'89/41': {
		seats: [
			{ cellId: '89/41', level: 2, face: 1, lift: 0, inset: 0.25782075661247816 },
			{ cellId: '89/41', level: 2, face: 1, lift: 6, inset: 0.25782075661247816 },
			{ cellId: '89/41', level: 2, face: 2, lift: 0, inset: 0.25782075661247816 },
			{ cellId: '89/41', level: 2, face: 2, lift: 6, inset: 0.25782075661247816 },
			{ cellId: '89/41', level: 2, face: 3, lift: 0, inset: 0.25782075661247816 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 0, 3],
			['bearing', 4, null],
			['brace', 4, 1],
			['brace', 4, 3]
		]
	},
	'87/50': {
		seats: [
			{ cellId: '87/50', level: 3, face: 0, lift: 0, inset: 0.4020456082119458 },
			{ cellId: '87/50', level: 3, face: 0, lift: 6, inset: 0.4020456082119458 },
			{ cellId: '87/50', level: 3, face: 1, lift: 0, inset: 0.4020456082119458 },
			{ cellId: '87/50', level: 3, face: 1, lift: 6, inset: 0.4020456082119458 },
			{ cellId: '87/50', level: 3, face: 2, lift: 0, inset: 0.4020456082119458 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 0, 3],
			['bearing', 4, null],
			['brace', 4, 1],
			['brace', 4, 3]
		]
	},
	'30/40': {
		seats: [
			{ cellId: '30/40', level: 1, face: 0, lift: 0, inset: 0.28311706803319897 },
			{ cellId: '30/40', level: 1, face: 0, lift: 6, inset: 0.28311706803319897 },
			{ cellId: '32/40', level: 1, face: 0, lift: 0, inset: 0.3174077646668311 },
			{ cellId: '32/40', level: 1, face: 0, lift: 6, inset: 0.3174077646668311 },
			{ cellId: '34/40', level: 1, face: 0, lift: 0, inset: 0.36523317761531965 },
			{ cellId: '34/40', level: 1, face: 0, lift: 6, inset: 0.36523317761531965 },
			{ cellId: '36/40', level: 1, face: 0, lift: 0, inset: 0.32681164272879537 },
			{ cellId: '36/40', level: 1, face: 0, lift: 6, inset: 0.32681164272879537 },
			{ cellId: '38/40', level: 1, face: 0, lift: 0, inset: 0.21862887791581032 },
			{ cellId: '38/40', level: 1, face: 0, lift: 6, inset: 0.21862887791581032 },
			{ cellId: '40/40', level: 1, face: 0, lift: 0, inset: 0.3326407789114656 },
			{ cellId: '40/40', level: 1, face: 0, lift: 6, inset: 0.3326407789114656 },
			{ cellId: '42/40', level: 1, face: 0, lift: 0, inset: 0.3306460418768445 },
			{ cellId: '42/40', level: 1, face: 0, lift: 6, inset: 0.3306460418768445 },
			{ cellId: '44/40', level: 1, face: 0, lift: 0, inset: 0.3374751405770073 },
			{ cellId: '44/40', level: 1, face: 0, lift: 6, inset: 0.3374751405770073 },
			{ cellId: '46/40', level: 1, face: 0, lift: 0, inset: 0.330393489431256 },
			{ cellId: '46/40', level: 1, face: 0, lift: 6, inset: 0.330393489431256 },
			{ cellId: '48/40', level: 1, face: 0, lift: 0, inset: 0.2912475031875973 },
			{ cellId: '48/40', level: 1, face: 0, lift: 6, inset: 0.2912475031875973 },
			{ cellId: '30/40', level: 1, face: 2, lift: 0, inset: 0.28311706803319897 },
			{ cellId: '32/40', level: 1, face: 2, lift: 0, inset: 0.3174077646668311 },
			{ cellId: '34/40', level: 1, face: 2, lift: 0, inset: 0.36523317761531965 },
			{ cellId: '36/40', level: 1, face: 2, lift: 0, inset: 0.32681164272879537 },
			{ cellId: '38/40', level: 1, face: 2, lift: 0, inset: 0.21862887791581032 },
			{ cellId: '40/40', level: 1, face: 2, lift: 0, inset: 0.3326407789114656 },
			{ cellId: '42/40', level: 1, face: 2, lift: 0, inset: 0.3306460418768445 },
			{ cellId: '44/40', level: 1, face: 2, lift: 0, inset: 0.3374751405770073 },
			{ cellId: '46/40', level: 1, face: 2, lift: 0, inset: 0.330393489431256 },
			{ cellId: '48/40', level: 1, face: 2, lift: 0, inset: 0.2912475031875973 }
		],
		rods: [
			['bearing', 0, null],
			['chord', 0, 1],
			['bearing', 2, null],
			['chord', 2, 3],
			['chord', 1, 3],
			['brace', 0, 3],
			['bearing', 4, null],
			['chord', 4, 5],
			['chord', 3, 5],
			['brace', 2, 5],
			['bearing', 6, null],
			['chord', 6, 7],
			['chord', 5, 7],
			['brace', 4, 7],
			['bearing', 8, null],
			['chord', 8, 9],
			['chord', 7, 9],
			['brace', 6, 9],
			['bearing', 10, null],
			['chord', 10, 11],
			['chord', 9, 11],
			['brace', 8, 11],
			['bearing', 12, null],
			['chord', 12, 13],
			['chord', 11, 13],
			['brace', 10, 13],
			['bearing', 14, null],
			['chord', 14, 15],
			['chord', 13, 15],
			['brace', 12, 15],
			['bearing', 16, null],
			['chord', 16, 17],
			['chord', 15, 17],
			['brace', 14, 17],
			['bearing', 18, null],
			['chord', 18, 19],
			['chord', 17, 19],
			['brace', 16, 19],
			['bearing', 20, null],
			['brace', 20, 1],
			['bearing', 21, null],
			['brace', 21, 3],
			['bearing', 22, null],
			['brace', 22, 5],
			['bearing', 23, null],
			['brace', 23, 7],
			['bearing', 24, null],
			['brace', 24, 9],
			['bearing', 25, null],
			['brace', 25, 11],
			['bearing', 26, null],
			['brace', 26, 13],
			['bearing', 27, null],
			['brace', 27, 15],
			['bearing', 28, null],
			['brace', 28, 17],
			['bearing', 29, null],
			['brace', 29, 19]
		]
	}
};

/** Restores the original ordered parts through the installation record owner. */
export function savedCarrier(world: World, first: string, use: 'water' | 'material' = 'material') {
	const { seats, rods } = frames[first];
	const parts = rods.map(([recipe, start, end]): Installation =>
		recipe === 'bearing'
			? { kind: 'pillar', recipe, anchor: seats[start] }
			: { kind: 'segment', recipe, anchor: seats[start], end: seats[end ?? start] }
	);
	return withState(
		world,
		install(world.state, { parts }, { kind: 'house', style: 'megastructure', use })
	);
}
