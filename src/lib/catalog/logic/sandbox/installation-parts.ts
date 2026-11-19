import type { ModuleRecipe } from '../house-brush';
import { STORY } from '../../data/grid';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';

export type Anchor = Readonly<{
	cellId: string;
	level: number;
	face?: number;
	vertex?: number;
	lift: number;
}>;
export type PartId = `p/${number}/${number}`;
export type Owner = `c/${number}`;
export type Composition = { id: Owner; system: 'houses' | 'paths' };
type Segment = { kind: 'segment'; recipe: 'chord' | 'brace' | 'walkway' | 'stair'; end: Anchor };
type Fixture =
	{ kind: 'pillar'; recipe: 'support' } | { kind: 'stop'; recipe: 'plaza' | 'landing' };
type Module = {
	kind: 'module';
	recipe: ModuleRecipe;
	attachedTo: PartId;
	share: number;
};
export type Installation = (Segment | Fixture | Module) & { anchor: Anchor };
export type BuiltPart = Installation & {
	id: PartId;
	owner: Owner;
	built: number;
	materials: Readonly<Record<string, number>>;
};
export type Failure = { reason: string; marks: Vec3[][] };
export type Proposal = { parts: Installation[]; owner?: Owner } | { failure: Failure };

/** Resolves a saved cell address against the current terrain in world meters. */
export function position(grid: QuadGrid, anchor: Anchor): Vec3 {
	const cell = grid.cellsById.get(anchor.cellId);
	if (!cell) throw new RangeError('Missing installation anchor');
	const z = cell.pad + anchor.level * STORY + anchor.lift;
	if (anchor.vertex !== undefined) {
		const [x, y] = cell.corners[anchor.vertex];
		return [x, y, z];
	}
	if (anchor.face === undefined) return [cell.center[0], cell.center[1], z];
	const a = cell.corners[anchor.face],
		b = cell.corners[(anchor.face + 1) % 4];
	return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z];
}

/** Marks a rejected survey in the same coordinate system as the cursor. */
export function rejected(reason: string, cells: readonly QuadCell[]): Proposal {
	return { failure: { reason, marks: cells.map((c) => [...c.corners, c.corners[0]]) } };
}
