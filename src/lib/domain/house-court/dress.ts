import type { Vec3 } from '../../core/geometry';
import { groundStoreyRuns, faceParts, type HousePart, type StoreyRun } from './part-refs';
import { defaults } from '../../../config/house-court';
import { readStoreyElevation, readStoreyHeight, cellCenter } from '../cell-space';
import { side } from './boxes';
import { pick, type CellSolid } from './fills';
import { builtAt, type Context } from './context';
import { bar, dome, inradius, rounded, wallFigure, type Faces } from './solids';
import type { OpeningKind } from './styles';
import { exposedWall, fitsOpening } from './wall-contact';

const {
	curveSegments,
	figureDepthM,
	collarShareRatio,
	capShareRatio,
	treeTrunkM,
	treeHeightM,
	treeCrownM,
	organicPlanterM
} = defaults;

// Exact arithmetic: corners of the opening figures.
const figureSides: Record<
	Exclude<OpeningKind, 'rect'>,
	number
> = /* Exact arithmetic: corner counts of opening shapes. */ {
	round: curveSegments,
	triangle: 3
};

function figuresOn(ctx: Context, s: CellSolid, i: number, storey: number) {
	const { opening } = ctx.style;
	const wall = side(s.cell.quad, i);
	const count = s.flat ? Math.max(1, Math.floor(wall.length / opening.pitchM)) : 1;
	if (wall.length < opening.pitchM / 2) return { panes: [], collars: [] };
	const h = readStoreyHeight(ctx.space, storey);
	const radius = Math.min(
		opening.sizeM,
		h / defaults.figureOpeningClearanceDivisor,
		wall.length / (count * defaults.figureOpeningClearanceDivisor)
	);
	// Keep the uniform path's coordinate arithmetic for existing house meshes.
	const z =
		ctx.space.storeyHeightM === undefined
			? readStoreyElevation(ctx.space, storey) + h / 2
			: ctx.space.baseZ + (storey + 1 / 2) * h;
	const visible = exposedWall(ctx.adjoiningWalls, wall, z - h / 2, z + h / 2);
	const along: [number, number] = [Math.cos(wall.rotation), Math.sin(wall.rotation)];
	const panes: Faces = [];
	const collars: Faces = [];
	for (let k = 0; k < count; k += 1) {
		const kind = pick(ctx.random, `${s.key}/opening/${i}/${storey}`, opening.kinds);
		if (kind === 'rect') continue;
		const t = (k + 1 / 2) / count;
		const u = t * wall.length;
		const reach = opening.collar ? radius * collarShareRatio : radius;
		if (
			ctx.adjoiningWalls.length &&
			!fitsOpening(visible, [u - reach, z - reach, u + reach, z + reach])
		)
			continue;
		const [x, y] = wall.at(t, -s.gapM);
		const at: Vec3 = [x, y, z];
		panes.push(...wallFigure(at, along, wall.normal, radius, figureSides[kind], figureDepthM * 2));
		if (opening.collar)
			collars.push(
				...wallFigure(
					at,
					along,
					wall.normal,
					radius * collarShareRatio,
					figureSides[kind],
					figureDepthM
				)
			);
	}
	return { panes, collars };
}

/** Figure openings (and collars) on every exposed side of every storey of each solid. */
export function figureOpenings(ctx: Context, solids: readonly CellSolid[]): HousePart[] {
	return solids.flatMap((s) => {
		if (s.key.endsWith('/roof')) return [];
		const panes: Faces = [];
		const collars: Faces = [];
		const paneRuns: StoreyRun[] = [];
		const collarRuns: StoreyRun[] = [];
		for (let storey = s.fromStorey; storey < s.toStorey; storey += 1)
			s.cell.sides.forEach(({ neighbour }, i) => {
				if (builtAt(ctx, neighbour, storey)) return;
				if (
					ctx.random.derive(`${s.key}/opening/${i}/${storey}/share`).number() >=
					ctx.style.opening.shareRatio
				)
					return;
				const result = figuresOn(ctx, s, i, storey);
				panes.push(...result.panes);
				collars.push(...result.collars);
				if (result.panes.length) paneRuns.push([s.cell.id, storey, storey + 1]);
				if (result.collars.length) collarRuns.push([s.cell.id, storey, storey + 1]);
			});
		return [
			...faceParts(`${s.key}/collars`, 'collar', collars, collarRuns),
			...faceParts(`${s.key}/openings`, 'opening', panes, paneRuns)
		];
	});
}

/** A planted cap on every dome roof. */
export function caps(ctx: Context, solids: readonly CellSolid[]): HousePart[] {
	if (!ctx.style.parts.planters) return [];
	return solids.flatMap((s) => {
		if (!s.key.endsWith('/roof')) return [];
		const rise = ctx.style.roof.riseRatio * readStoreyHeight(ctx.space, s.fromStorey);
		const r = inradius(s.outline) * capShareRatio;
		const base = readStoreyElevation(ctx.space, s.fromStorey) + rise * (1 - capShareRatio);
		return faceParts(
			`${s.key}/cap`,
			'planter',
			dome(
				rounded(s.outline, inradius(s.outline) - r, r * capShareRatio),
				base,
				rise * capShareRatio + organicPlanterM
			),
			[[s.cell.id, s.fromStorey, s.toStorey]]
		);
	});
}

/** Trees in a share of the court cells, rising with complexity, each inside its cell. */
export function trees(ctx: Context): HousePart[] {
	const share = ctx.style.parts.treeShareRatio * ctx.complexity;
	return ctx.space.cells.flatMap((cell) => {
		if (
			ctx.occupancy.get(cell.id)?.role !== 'court' ||
			ctx.random.derive(`${cell.id}/tree`).number() >= share
		)
			return [];
		const [x, y] = cellCenter(cell);
		const z = ctx.space.baseZ;
		const crown = Math.min(treeCrownM, inradius(cell.quad) * capShareRatio);
		const crownPlan = rounded(cell.quad, inradius(cell.quad) - crown, crown * capShareRatio);
		return [
			...faceParts(
				`${cell.id}/trunk`,
				'trunk',
				bar([x, y, z], [x, y, z + treeHeightM - crown / 2], treeTrunkM),
				groundStoreyRuns(cell.id)
			),
			...faceParts(
				`${cell.id}/crown`,
				'foliage',
				dome(crownPlan, z + treeHeightM - crown, crown),
				groundStoreyRuns(cell.id)
			)
		];
	});
}
