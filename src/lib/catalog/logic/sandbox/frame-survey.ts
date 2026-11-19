import { STORY } from '../../data/grid';
import { hashUnit } from '../../core/random';
import {
	compileSeams,
	seamPolicy,
	type Character,
	type EdgeUse,
	type FrameSeam
} from '../district-frame';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import type { World } from './world';
import type { Vec3 } from '../parametrik/types';
import { insetRing, roofWalls } from '../house-brush';
import { buildingPlots } from './building-plots';

import { surveyGates } from './frame-gates';

import { courtOpenings } from './court-openings';
import { seamIncidence, seamVertices } from './seam-incidence';
const policy = seamPolicy();
const districts = new WeakMap<TerrainGrid, Map<string, Character>>();
function characters(grid: TerrainGrid) {
	const cached = districts.get(grid);
	if (cached) return cached;
	const result = new Map<string, Character>();
	for (const cell of grid.cells) {
		const old = result.get(cell.block);
		if (old === 'quiet' || old === 'shore') continue;
		if (hashUnit(grid.terrain.seed, cell.block, 'tg-quiet') < policy.quietDistrictShare) {
			result.set(cell.block, 'quiet');
			continue;
		}
		const border = cell.neighbors.flatMap((id) => (id ? (grid.cellsById.get(id) ?? []) : []));
		if (border.some((n) => n.plan.kind === 'riversidePromenade')) result.set(cell.block, 'shore');
		else if (border.some((n) => n.zone === 'scarp')) result.set(cell.block, 'slope');
		else if (
			old !== 'slope' &&
			(cell.neighbors.includes(null) || border.some((n) => n.zone === 'water'))
		)
			result.set(cell.block, 'neutral');
		else if (!old) result.set(cell.block, 'core');
	}
	districts.set(grid, result);
	return result;
}

function edgeUse(
	house: TerrainCell,
	other: TerrainCell | undefined,
	roofStep: number | undefined
): EdgeUse {
	if (other?.plan.square) return 'court';
	if (other?.plan.kind === 'riversidePromenade') return 'shore';
	if (
		other &&
		(other.zone === 'scarp' || Math.abs(house.center[2] - other.center[2]) >= policy.groundStepMin)
	)
		return 'slope';
	if (other?.plan.kind === 'mainAlley') return 'frontage';
	if (roofStep === undefined) return 'land';
	return roofStep >= policy.roofStepMin ? 'step' : 'houses';
}
function opening(
	house: TerrainCell,
	other: TerrainCell | undefined,
	grid: TerrainGrid,
	side: number
) {
	if (!other) return 'rim';
	const court = courtOpenings(grid).get(JSON.stringify(seamVertices(house, side)));
	if (court) return court;
	if (house.plan.square && other.plan.square) return 'square-interior';
	if (other.zone === 'water' || house.zone === 'water') return 'water';
	if (house.zone === 'scarp' && other.zone === 'scarp') return 'scarp-interior';
	const rank = other.plan.kind ?? house.plan.kind;
	if (rank === 'alley' || rank === 'stairAlley' || rank === 'footbridge') return 'passage';
	if (house.plan.edgePassage && house.alleyEdges & (1 << side)) return 'reserved-frontage';
}

import type { BaySurvey } from '../megastructure';
/** Surveys incident terrain seams and records the supporting wall and a return wall on the same roof. */
function surveyFrame(world: World, includeEmpty: boolean) {
	const { grid, state, seed } = world;
	const plots = buildingPlots(grid);
	const seams = new Map<string, FrameSeam>(),
		bays = new Map<string, BaySurvey>();
	const character = characters(grid);
	const incidence = seamIncidence(grid);
	const roads = new Map<string, TerrainCell>();
	const attachments = new Set(
		[...state.parts.values()].flatMap((p) =>
			p.kind === 'module' || p.recipe === 'walkway' ? [p.anchor.cellId] : []
		)
	);
	for (const id of state.stacks.keys()) {
		const cell = grid.cellsById.get(id),
			plot = plots.cellsById.get(id);
		const count = state.stacks.get(id)?.length ?? 0;
		if (!cell || !count || !plot) continue;
		const height = cell.pad + count * STORY;
		const wall = roofWalls(plots, state.stacks, plot, seed);
		const ring = insetRing(
			plot.corners.map(([x, y]) => [x, y]),
			wall.inset
		);
		for (const [side, n] of cell.neighbors.entries()) {
			const other = n ? grid.cellsById.get(n) : undefined;
			if (other?.plan.kind) roads.set(other.id, other);
			const stories = n ? (state.stacks.get(n)?.length ?? 0) : 0;
			const otherHeight = other && stories ? other.pad + stories * STORY : undefined;
			if (
				other &&
				otherHeight !== undefined &&
				(otherHeight > height || (otherHeight === height && other.id < id))
			)
				continue;
			const next = (side + 1) % 4;
			const va = cell.vertexIds[side],
				vb = cell.vertexIds[next];
			const vertices: [string, string] = va < vb ? [va, vb] : [vb, va];
			const key = JSON.stringify(vertices);
			const roofPoint = (i: number): Vec3 => [ring[i][0], ring[i][1], height];
			const a = roofPoint(side),
				b = roofPoint(next);
			const returnSide = [(side + 2) % 4, (side + 1) % 4, (side + 3) % 4].find(
				(i) => wall.exposed[i]
			);
			const rear0 = roofPoint(returnSide ?? side),
				rear1 = roofPoint(((returnSide ?? side) + 1) % 4);
			const clearances = cell.neighbors.flatMap((n) => {
				const near = n && grid.cellsById.get(n);
				return near &&
					(near.zone === 'water' || near.plan.square || near.plan.kind || state.stacks.has(near.id))
					? [near.corners]
					: [];
			});
			bays.set(key, {
				id: key,
				a,
				b,
				clearances,
				back: rear0.map((v, i) => (v + rear1[i]) / 2) as Vec3
			});
			seams.set(key, {
				id: key,
				vertices,
				houses: other && stories ? [id, other.id] : [id],
				intent: state.frameIntents?.get(key),
				district: cell.block,
				character: character.get(cell.block) ?? 'neutral',
				adjacentCharacter: other && character.get(other.block),
				higherSide: otherHeight === height ? undefined : id,
				roofDifference: otherHeight === undefined ? undefined : height - otherHeight,
				frontage: other?.plan.kind ?? undefined,
				use: edgeUse(cell, other, otherHeight === undefined ? undefined : height - otherHeight),
				districtEdge: !!other && other.block !== cell.block,
				opening:
					opening(cell, other, grid, side) ??
					(!wall.exposed[side] || returnSide === undefined ? 'no-wall-bearing' : undefined),
				blocker: other?.id,
				attachment: attachments.has(id) || (!!n && attachments.has(n))
			});
		}
	}
	surveyGates(world, roads.values(), plots, character, seams, bays);
	if (includeEmpty)
		for (const edge of incidence.values()) {
			if (seams.has(edge.id)) continue;
			const [a, b] = edge.sides;
			const cell = grid.cellsById.get(a.cellId),
				other = b && grid.cellsById.get(b.cellId);
			if (!cell) continue;
			seams.set(edge.id, {
				id: edge.id,
				vertices: edge.vertices,
				houses: [],
				district: cell.block,
				character: character.get(cell.block) ?? 'neutral',
				districtEdge: !!other && cell.block !== other.block,
				use: 'land',
				opening: opening(cell, other, grid, a.side) ?? 'unoccupied',
				blocker: other?.id
			});
		}
	const sides = new Map<string, string[]>();
	for (const s of seams.values())
		for (const h of s.houses) {
			const list = sides.get(h) ?? [];
			list.push(s.id);
			sides.set(h, list);
		}
	function supportedBay(id: string, roles: ReadonlyMap<string, { role: string }>) {
		const bay = bays.get(id),
			owner = seams.get(id);
		if (!bay || !owner) return;
		const gaps: [Vec3, Vec3][] = [];
		for (const key of new Set(owner.houses.flatMap((h) => sides.get(h) ?? []))) {
			const edge = bays.get(key);
			if (key !== id && roles.get(key)?.role === 'gap' && edge) gaps.push([edge.a, edge.b]);
		}
		return { ...bay, gaps };
	}
	return {
		incidence,
		seams,
		bays,
		supportedBay,
		characters: character,
		rules: compileSeams(seams.values(), policy),
		seed
	};
}

const occupiedSurveys = new WeakMap<World, ReturnType<typeof surveyFrame>>();
/** Shares the immutable occupied survey across pointer updates. Reports may request all carrier gaps. */
export function frameSurvey(world: World, includeEmpty = false) {
	if (includeEmpty) return surveyFrame(world, true);
	const cached = occupiedSurveys.get(world);
	if (cached) return cached;
	const survey = surveyFrame(world, false);
	occupiedSurveys.set(world, survey);
	return survey;
}
