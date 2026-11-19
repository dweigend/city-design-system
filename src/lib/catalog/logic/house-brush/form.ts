import type { ManifoldToplevel } from 'manifold-3d';
import { flowToken } from '../../data/focus';
import type { ColorToken, Primitive } from '../parametrik/types';
import type { QuadGrid } from '../quad-grid';
import type { HouseUse, Stacks } from './stacks';

type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Geometry of a primitive without identity, role and color. */
export type Form = Without<Primitive, 'id' | 'role' | 'token' | 'material'>;

/** What every rule of the grammar reads: the grid, the painted stacks and the seed. */
export type Site = Readonly<{
	grid: QuadGrid;
	stacks: Stacks;
	seed: number;
	kernel?: ManifoldToplevel;
}>;

/** One draw channel per decision of the grammar (PD-4). */
export const CHANNEL = {
	opening: 11,
	crown: 12,
	crownTurn: 13,
	corner: 14,
	tiers: 15,
	roof: 16,
	ridge: 17
};

/** Share of ink in the pane of a plain window: dark on a white wall. */
const PANE_SHADE = 0.78;

/**
 * Accent of a use: the color of its flow (data/focus.ts). The plain house has none; its
 * details stay paper and ink.
 */
export const accentOf = (use: HouseUse): ColorToken | undefined =>
	use === 'living' ? undefined : flowToken[use];

/** A new part in the shared render contract. */
export const part = (id: string, token: ColorToken, form: Form): Primitive => ({
	id,
	role: 'neu',
	material: 'concrete',
	token,
	...form
});

/** A detail part: an opening or a crown figure in the accent of its use, or as a dark pane. */
export const detail = (id: string, use: HouseUse, form: Form): Primitive => {
	const accent = accentOf(use);
	return { ...part(id, accent ?? '--paper', form), detail: true, shade: accent ? 0 : PANE_SHADE };
};
