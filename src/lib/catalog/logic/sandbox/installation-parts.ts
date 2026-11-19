import { FRAME_DIAMETER } from '../megastructure';
import type { FlowId } from '../../data/focus';
import {
	atSocket,
	castingSeed,
	boundaryRings,
	type SocketFit,
	type ModuleRecipe
} from '../house-brush';
import { STORY } from '../../data/grid';
import type { FinishId, Vec3 } from '../parametrik/types';
import type { QuadCell, QuadGrid } from '../quad-grid';

export type Anchor = Readonly<{
	cellId: string;
	level: number;
	face?: number;
	inset?: number;
	vertex?: number;
	lift: number;
}>;
export type PartId = `p/${number}/${number}` | `tg/${string}/${number}`;
export type Owner = `c/${number}` | `tg/${string}`;
export type Composition = { id: Owner; system: 'houses' | 'paths' };
type Segment = {
	frame?: Readonly<{ seam: string; gate: boolean; member: { a: Vec3; b: Vec3; diameter: number } }>;
	kind: 'segment';
	recipe: 'chord' | 'brace' | 'walkway' | 'stair';
	end: Anchor;
};
type Fixture =
	{ kind: 'pillar'; recipe: 'support' | 'bearing' } | { kind: 'stop'; recipe: 'plaza' | 'landing' };
type Module = {
	kind: 'module';
	recipe: ModuleRecipe;
	/** Unversioned target fittings used a round proxy. Unversioned Q2 ceramic uses the profile fit. */
	fit?: SocketFit;
	attachedTo: PartId;
	share: number;
	pitch: number;
};
export type Installation = (Segment | Fixture | Module) & { anchor: Anchor; finish?: FinishId };
export type BuiltPart = Installation & {
	id: PartId;
	owner: Owner;
	built: number;
	/** Construction flow for the timeline. Older installations predate flow records. */
	flow?: FlowId;
	materials: Readonly<Record<string, number>>;
};
/** Restores the original seat for both rendering and subsequent obstruction checks. */
export function savedSocket(
	rod: NonNullable<ReturnType<typeof rodOf>>,
	p: Module & { anchor: Anchor },
	seed: number
) {
	const fit = p.fit ?? (p.recipe === 'ceramic' ? 'profile-v1' : 'round-v0');
	return atSocket(rod, p.share, p.recipe, [], p.pitch, castingSeed(seed, p.anchor.cellId), fit);
}
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
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		shift = (anchor.inset ?? 0) / Math.hypot(dx, dy);
	return [(a[0] + b[0]) / 2 - dy * shift, (a[1] + b[1]) / 2 + dx * shift, z];
}

/** Marks a rejected survey in the same coordinate system as the cursor. */
export function rejected(reason: string, cells: readonly QuadCell[]): Proposal {
	const ids = new Set(cells.map((c) => c.id));
	const heights = new Map(
		cells.flatMap((c) => c.corners.map((p) => [p[0] + ',' + p[1], p[2]] as const))
	);
	const marks = boundaryRings(cells, (id) => ids.has(id)).map((ring) =>
		ring.map(([x, y]): Vec3 => [x, y, (heights.get(x + ',' + y) ?? 0) + 0.1])
	);
	return { failure: { reason, marks } };
}

/** Returns the physical axis and section used by the solver and the docking survey. */
export function rodOf<P extends Installation>(grid: QuadGrid, part: P) {
	if (part.kind !== 'segment' || (part.recipe !== 'chord' && part.recipe !== 'brace')) return;
	return {
		part,
		a: part.frame?.member.a ?? position(grid, part.anchor),
		b: part.frame?.member.b ?? position(grid, part.end),
		radius:
			(part.frame?.member.diameter ?? FRAME_DIAMETER[part.recipe === 'chord' ? 'main' : 'brace']) /
			2
	};
}
