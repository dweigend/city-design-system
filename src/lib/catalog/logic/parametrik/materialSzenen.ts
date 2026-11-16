/**
 * Scenes of the material lab (L12) and the Material page: matrix form × material,
 * tower (white-model ghost, milky hull, colored core; 48, 27) and existing stock with intervention (43).
 */
import { flowToken } from '../../data/focus';
import { materials } from '../../data/material';
import type { ColorToken, MaterialId, Primitive, Role, Vec3 } from './types';

export const materialForms = [
	{ id: 'box', name: 'Box' },
	{ id: 'cylinder', name: 'Zylinder' },
	{ id: 'dome', name: 'Kuppel' },
	{ id: 'vault', name: 'Tonne' },
	{ id: 'capsule', name: 'Kapsel' }
] as const;
export type MaterialForm = (typeof materialForms)[number]['id'];

const CELL = 7;

type Base = { token: ColorToken; role: Role; material: MaterialId };

/** One sample form in a 5 m cell, base center at (x, y). */
export function sampleForm(
	id: string,
	form: MaterialForm,
	x: number,
	y: number,
	b: Base
): Primitive {
	const base = { id, ...b };
	switch (form) {
		case 'box':
			return { ...base, kind: 'box', position: [x - 2, y - 2, 0], size: [4, 4, 4] };
		case 'cylinder':
			return { ...base, kind: 'cylinder', position: [x, y, 0], radius: 2, height: 4.4 };
		case 'dome':
			return { ...base, kind: 'dome', position: [x, y, 0], radius: 2.4 };
		case 'vault':
			return { ...base, kind: 'vault', position: [x, y, 0], width: 4.4, length: 4.4, rise: 2.6 };
		case 'capsule':
			return {
				...base,
				kind: 'capsule',
				from: [x - 1.6, y, 1.4],
				to: [x + 1.6, y, 1.4],
				radius: 1.4
			};
	}
}

/** Plan lines and a post behind every sample: what shines through shows transparency and diffusion. */
function backdrop(id: string, x: number, y: number): Primitive[] {
	const line = (n: string, points: Vec3[], closed = false): Primitive => ({
		id: `${id}-${n}`,
		kind: 'polyline',
		points,
		closed,
		role: 'neu',
		token: '--paper',
		material: 'paper'
	});
	const h = CELL / 2 - 0.4;
	return [
		line(
			'plan',
			[
				[x - h, y - h, 0],
				[x + h, y - h, 0],
				[x + h, y + h, 0],
				[x - h, y + h, 0]
			],
			true
		),
		line('cross', [
			[x - h, y - h, 0],
			[x + h, y + h, 0]
		]),
		line('post', [
			[x - 0.6, y + 0.6, 0],
			[x - 0.6, y + 0.6, 5.2]
		]),
		line('bar', [
			[x - h, y + 0.6, 2.2],
			[x + h, y + 0.6, 2.2]
		])
	];
}

/** Small colored core inside each sample: visible only through translucent materials. */
const core = (id: string, x: number, y: number, token: ColorToken): Primitive => ({
	id: `${id}-core`,
	kind: 'box',
	position: [x - 0.7, y - 0.7, 0],
	size: [1.4, 1.4, 1.6],
	token: token === '--paper' ? '--cat-living' : token,
	role: 'neu',
	material: 'metal'
});

/** Matrix: rows = materials, columns = forms (or one form). */
export function materialMatrix(
	ids: MaterialId[],
	forms: MaterialForm[],
	token: ColorToken,
	withCore = true
): Primitive[] {
	const out: Primitive[] = [];
	ids.forEach((material, row) =>
		forms.forEach((form, col) => {
			const x = col * CELL,
				y = -row * CELL,
				id = `m-${material}-${form}`;
			out.push(...backdrop(id, x, y));
			if (withCore) out.push(core(id, x, y, token));
			out.push(sampleForm(id, form, x, y, { token, role: 'neu', material }));
		})
	);
	return out;
}

export const allMaterialIds = materials.map((m) => m.id);

/* ── Tower: white-model ghost + milky hull + colored core ───────────── */

export function towerScene(token: ColorToken): Primitive[] {
	const flow = token;
	const out: Primitive[] = [];
	const P = (p: Record<string, unknown>) => out.push({ role: 'neu', ...p } as Primitive);
	const W = 12;
	// White-model ghost: decks and columns.
	for (const [i, z] of [0, 4.5, 9, 13.5].entries()) {
		P({
			id: `deck-${i}`,
			kind: 'box',
			position: [0, 0, z],
			size: [W, W, 0.5],
			token: '--paper',
			material: 'ghost'
		});
		if (i < 3)
			for (const [cx, cy] of [
				[0.3, 0.3],
				[W - 0.9, 0.3],
				[0.3, W - 0.9],
				[W - 0.9, W - 0.9]
			])
				P({
					id: `col-${i}-${cx}-${cy}`,
					kind: 'box',
					position: [cx, cy, z + 0.5],
					size: [0.6, 0.6, 4],
					token: '--paper',
					material: 'ghost'
				});
	}
	// Concrete core through all decks.
	P({
		id: 'kern',
		kind: 'box',
		position: [5, 5, 0],
		size: [2.2, 2.2, 18],
		token: '--paper',
		material: 'concrete'
	});
	// Colored modules (lacquered steel and plaster) plugged into the frame.
	P({
		id: 'mod-a',
		kind: 'box',
		position: [1, 1, 0.5],
		size: [3.6, 3, 3.2],
		token: flow,
		material: 'metal'
	});
	P({
		id: 'mod-b',
		kind: 'box',
		position: [8.5, 7.5, 5],
		size: [5, 3.2, 3.2],
		token: flow,
		material: 'paper'
	});
	P({
		id: 'mod-c',
		kind: 'capsule',
		from: [2, 9.5, 11],
		to: [6.5, 9.5, 11],
		radius: 1.4,
		token: flow,
		material: 'glaze'
	});
	// Greenhouse on deck 1.
	P({
		id: 'garten',
		kind: 'box',
		position: [1, 7.5, 5],
		size: [4.5, 3.6, 3],
		token: '--cat-nature',
		material: 'greenhouse'
	});
	// Milky hull on top around a colored core (48: building above the tower).
	P({
		id: 'huelle',
		kind: 'box',
		position: [1.5, 1.5, 14],
		size: [9, 9, 6.5],
		token: '--paper',
		material: 'acrylic',
		floors: [17.2]
	});
	P({
		id: 'kopf-kern',
		kind: 'box',
		position: [4, 4, 14],
		size: [4, 4, 3],
		token: flow,
		material: 'metal'
	});
	// Membrane cushion as roof hull, water basin on the ground.
	P({
		id: 'pneu',
		kind: 'dome',
		position: [6, 6, 20.5],
		radius: 4,
		height: 2.6,
		token: '--paper',
		material: 'membrane'
	});
	P({
		id: 'becken',
		kind: 'box',
		position: [W + 1, 1, 0],
		size: [6, 9, 0.8],
		token: '--cat-health',
		material: 'water'
	});
	P({
		id: 'ufer',
		kind: 'box',
		position: [W + 0.6, 0.6, 0],
		size: [6.8, 9.8, 0.4],
		token: '--paper',
		material: 'concrete'
	});
	return out;
}

/* ── Existing stock semi-transparent with intervention (43) ───────── */

export function bestandScene(token: ColorToken): Primitive[] {
	const flow = token;
	const out: Primitive[] = [];
	const add = (p: Primitive) => out.push(p);
	// Existing block: three houses as ghost, one as paper (both allowed for existing stock).
	const houses: [number, number, number, number, MaterialId][] = [
		[0, 0, 8, 14, 'ghost'],
		[8.5, 0, 7, 11, 'ghost'],
		[16, 0, 8, 16, 'paper'],
		[0, 9, 10, 9, 'ghost']
	];
	houses.forEach(([x, y, w, h, material], i) =>
		add({
			id: `existing-${i}`,
			kind: 'box',
			position: [x, y, 0],
			size: [w, 8, h],
			token: '--paper',
			role: 'bestand',
			material,
			floors: Array.from({ length: Math.floor(h / 3.5) }, (_, k) => (k + 1) * 3.5).filter(
				(z) => z < h
			)
		})
	);
	add({
		id: 'existing-roof',
		kind: 'wedge',
		position: [0, 0, 14],
		size: [8, 8, 4],
		low: 0,
		token: '--paper',
		role: 'bestand',
		material: 'ghost'
	});
	// Intervention: steel frame tower, bridge, pipe and a milky Aufstockung with colored core.
	// The selector sets the shared function of module and supply pipe; structure and walk stay fixed.
	const neu = { role: 'neu' as const, token: flow };
	add({
		id: 'geruest',
		kind: 'frame',
		position: [-4.5, 3, 0],
		size: [3.5, 3.5, 20],
		cells: [1, 1, 5],
		bar: 0.3,
		braced: true,
		material: 'metal',
		...neu,
		token: '--signal'
	});
	add({
		id: 'steg',
		kind: 'box',
		position: [-1, 3.5, 14],
		size: [9.5, 2.5, 0.6],
		material: 'metal',
		...neu,
		token: flowToken.people as ColorToken
	});
	add({
		id: 'aufstockung',
		kind: 'box',
		position: [9, 1, 11],
		size: [6, 6, 5],
		token: '--paper',
		role: 'neu',
		material: 'acrylic',
		floors: []
	});
	add({
		id: 'aufstockung-kern',
		kind: 'box',
		position: [10.5, 2.5, 11],
		size: [3, 3, 3],
		material: 'metal',
		...neu
	});
	add({
		id: 'leitung',
		kind: 'pipe',
		points: [
			[-2.8, 4.8, 18],
			[6, 4.8, 18],
			[12, 4.8, 16],
			[12, 4.8, 14]
		],
		radius: 0.45,
		material: 'metal',
		...neu
	});
	add({
		id: 'haube',
		kind: 'vault',
		position: [20, 4, 16],
		width: 6,
		length: 6,
		rise: 3,
		token: '--paper',
		role: 'neu',
		material: 'glass'
	});
	return out;
}
