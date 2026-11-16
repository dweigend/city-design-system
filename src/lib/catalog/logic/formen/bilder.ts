/**
 * Frames of the explainer loops as primitives (headless). The scene only sets group offsets
 * (person) per frame; geometry is created here, and only when the key changes.
 */
import { caseSlot, type SlotShape } from '../parametrik/formen/eckvorschau';
import { eckModul } from '../parametrik/formen/eck';
import { funktion } from '../parametrik/eckraster/funktion';
import { flowToken } from '../../data/focus';
import type { CornerMask } from '../parametrik/eck';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
import { ebenen, eckeGesetzt, WEG } from './loops';

const linie = (id: string, points: Vec3[], closed = false): Primitive => ({
	id,
	kind: 'polyline',
	points,
	closed,
	role: 'bestand',
	token: '--paper',
	material: 'concrete'
});

/* ── Loop 2 ── */

export const ECK_HOEHE = 8;

/** Id of a corner marker; the scene resolves clicks through it. */
export const eckId = (ecke: number) => `ecke:${ecke}`;
export const eckAusId = (id: string | undefined) => {
	const m = /^ecke:(\d)$/.exec(id ?? '');
	return m ? Number(m[1]) : undefined;
};

/** Slot with cage, corner markers (filled = sphere in signal, empty = small gray dot) and module. */
export function eckBild(mask: CornerMask, form: SlotShape, token?: ColorToken): Primitive[] {
	const slot = caseSlot({ key: 'formen-ecken', mask, title: '' }, form, 7, token);
	const at = (i: number): Vec3 => {
		const [x, y] = slot.corners[i % 4];
		return [x, y, i < 4 ? slot.zLow : slot.zHigh];
	};
	const kaefig: Primitive[] = [
		linie('kaefig-u', [0, 1, 2, 3].map(at), true),
		linie('kaefig-o', [4, 5, 6, 7].map(at), true),
		...[0, 1, 2, 3].map((i) => linie(`kaefig-${i}`, [at(i), at(i + 4)]))
	];
	const marken: Primitive[] = Array.from({ length: 8 }, (_, i) => {
		const voll = eckeGesetzt(mask, i);
		return {
			id: eckId(i),
			kind: 'sphere',
			position: at(i),
			radius: voll ? 0.55 : 0.32,
			role: voll ? 'neu' : 'bestand',
			token: voll ? '--signal' : '--paper',
			material: 'concrete'
		};
	});
	return [...kaefig, ...(mask ? eckModul(slot) : []), ...marken];
}

/* ── Loop 3 ── */

/** Fixed parts: square, levels (up to `erreicht` in their color), ramp, trees on the garden. */
export function wegTurm(erreicht: number): Primitive[] {
	const out: Primitive[] = [];
	const ring = (r: number, n = 48): Vec3[] =>
		Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return [Math.cos(a) * r, Math.sin(a) * r, 0];
		});
	out.push(linie('platz', ring(WEG.aussen + 2.5), true));
	ebenen.forEach((e, i) => {
		const farbig = i < erreicht;
		const token = (farbig ? funktion(e.funktion).token : null) ?? '--paper';
		const garten = e.id === 'garten';
		out.push({
			id: `ebene:${e.id}`,
			kind: 'cylinder',
			position: [0, 0, e.z],
			radius: garten ? WEG.kern + 0.3 : WEG.kern,
			height: garten ? e.hoehe : e.hoehe - 0.35,
			role: 'neu',
			token,
			material: 'concrete'
		});
		if (!garten)
			out.push({
				id: `decke:${e.id}`,
				kind: 'cylinder',
				position: [0, 0, e.z + e.hoehe - 0.35],
				radius: WEG.kern + 0.25,
				height: 0.35,
				role: 'neu',
				token: '--paper',
				material: 'concrete'
			});
	});
	// Garden: three ball trees, in color only on arrival.
	const gruen = erreicht >= ebenen.length ? (flowToken.food as ColorToken) : '--paper';
	[
		[1.8, 1.2, 1.6],
		[-2.2, 0.4, 1.3],
		[0.2, -2.4, 1.1]
	].forEach(([x, y, r], i) => {
		const z = WEG.hoehe + 0.6;
		out.push({
			id: `baum-stamm:${i}`,
			kind: 'cylinder',
			position: [x, y, z],
			radius: 0.12,
			height: r * 1.3,
			role: 'neu',
			token: '--paper',
			material: 'wood'
		});
		out.push({
			id: `baum:${i}`,
			kind: 'sphere',
			position: [x, y, z + r * 1.3 + r * 0.7],
			radius: r,
			role: 'neu',
			token: gruen,
			material: 'concrete'
		});
	});
	out.push({
		id: 'rampe',
		kind: 'helix',
		position: [0, 0, 0],
		radius: WEG.aussen,
		innerRadius: WEG.innen,
		height: WEG.hoehe,
		turns: WEG.windungen,
		thickness: 0.3,
		role: 'neu',
		token: flowToken.people as ColorToken,
		material: 'concrete'
	});
	return out;
}

/** Person at the origin (group "mensch"); the scene moves them. */
export const mensch: Primitive[] = [
	{
		id: 'mensch:koerper',
		kind: 'capsule',
		from: [0, 0, 0.5],
		to: [0, 0, 1.5],
		radius: 0.4,
		role: 'neu',
		token: '--signal',
		material: 'concrete'
	},
	{
		id: 'mensch:kopf',
		kind: 'sphere',
		position: [0, 0, 2.35],
		radius: 0.38,
		role: 'neu',
		token: '--signal',
		material: 'concrete'
	}
];

/** Group of a primitive for offsets. */
export const wegGruppe = (p: Primitive) => (p.id.startsWith('mensch:') ? 'mensch' : '');
