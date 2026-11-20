import { assetRegistry, buildObject } from '../assets';
import { translate } from '../ansicht/geometrie';
import { required } from '../required';
import type { Primitive, Vec3 } from '../parametrik/types';
import { privateSurface } from './town-palette';

const definitions = new Map(assetRegistry.map((asset) => [asset.id, asset]));
/** Looks up the rigid reservation and released variants of a town fitting. */
export function fitting(id: string) {
	return required(definitions.get(id), id);
}

/** Places a registry fitting at its native size, turning deck-line figures along the span. */
export function mountFitting(
	id: string,
	variant: string,
	at: Vec3,
	key: string,
	seed: number,
	angle = 0
) {
	const turn = ([x, y, z]: Vec3): Vec3 => [
		at[0] + x * Math.cos(angle) - y * Math.sin(angle),
		at[1] + x * Math.sin(angle) + y * Math.cos(angle),
		at[2] + z
	];
	const definition = fitting(id);
	// Standalone scatter may expose body; embedded staffage uses figure. Honour released graphite defaults.
	const slots =
		id.startsWith('kit-scatter-') &&
		definition.slotDefaults[variant][definition.slotNames[0]].finish !== 'metall-graphit' &&
		!definition.slotNames.includes('figure')
			? {
					[definition.slotNames[0]]: { token: '--ink' as const, finish: 'metall-graphit' as const }
				}
			: undefined;
	return buildObject(id, variant, seed, { instanceId: key + '/' + id, slots }).parts.map(
		(part): Primitive => {
			const p = privateSurface(part);
			if (!angle) return translate(p, at);
			switch (p.kind) {
				case 'sphere':
					return { ...p, position: turn(p.position) };
				case 'mesh':
					return { ...p, points: p.points.map(turn) };
				case 'capsule':
					return { ...p, from: turn(p.from), to: turn(p.to) };
				default:
					throw Error('Unexpected deck scatter geometry ' + p.kind);
			}
		}
	);
}

export type Reservation = { x: number; y: number; w: number; d: number };
/** Checks disjoint metre-space fitting reservations, including a hand-width of clearance. */
export function available(b: Reservation, taken: readonly Reservation[]) {
	return taken.every(
		(o) => Math.abs(o.x - b.x) * 2 >= o.w + b.w + 0.1 || Math.abs(o.y - b.y) * 2 >= o.d + b.d + 0.1
	);
}
