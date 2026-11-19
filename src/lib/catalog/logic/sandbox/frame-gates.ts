import { roofWalls, insetRing } from '../house-brush';
import { gateBlocker } from './gate-clearance';
import { HOCHWEG_M } from '../../data/stadtHochwege';
import { STORY } from '../../data/grid';
import type { BaySurvey } from '../megastructure';
import type { FrameSeam, Character } from '../district-frame';
import type { QuadGrid } from '../quad-grid';
import type { TerrainCell } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import type { World } from './world-contract';

/** Adds a transverse seam only when each end has a surveyed roof crown and the route rank permits a gate. */
export function surveyGates(
	world: World,
	roads: Iterable<TerrainCell>,
	plots: QuadGrid,
	characters: ReadonlyMap<string, Character>,
	seams: Map<string, FrameSeam>,
	bays: Map<string, BaySurvey>
) {
	for (const road of roads) {
		const kind = road.plan.kind,
			direction = road.plan.direction;
		if (
			(kind !== 'mainAlley' && kind !== 'riversidePromenade') ||
			road.plan.square ||
			(direction !== 'along' && direction !== 'across') ||
			road.zone === 'water' ||
			road.zone === 'scarp'
		)
			continue;
		const side = direction === 'along' ? 1 : 0;
		const next = (side + 1) % 4,
			across = road.neighbors[side];
		const route = across && world.grid.cellsById.get(across);
		if (
			!route ||
			route.plan.kind !== kind ||
			route.plan.square ||
			route.zone === 'water' ||
			route.zone === 'scarp'
		)
			continue;
		const ends = [(side + 3) % 4, next].map((s, index) => {
			const id = road.neighbors[s];
			const house = id && plots.cellsById.get(id);
			const levels = id && world.state.stacks.get(id)?.length;
			if (!house || !levels) return;
			const vertex = road.vertexIds[index === 0 ? side : next];
			const k = house.vertexIds.indexOf(vertex);
			if (k < 0) return;
			const wall = roofWalls(plots, world.state.stacks, house, world.seed);
			if (!wall.exposed[k] || !wall.exposed[(k + 3) % 4]) return;
			const ring = insetRing(
				house.corners.map(([x, y]) => [x, y]),
				wall.inset
			);
			const p = ring[k],
				height = house.pad + levels * STORY;
			const foot: Vec3 = [p[0], p[1], height];
			const shoes = [(k + 1) % 4, (k + 3) % 4].map((j) => {
				const q = ring[j];
				return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, height] satisfies Vec3;
			});
			return { id: house.id, vertex, foot, shoes };
		});
		const [a, b] = ends;
		if (!a || !b) continue;
		const vertices: [string, string] =
			a.vertex < b.vertex ? [a.vertex, b.vertex] : [b.vertex, a.vertex];
		const id = JSON.stringify(vertices);
		if (seams.has(id)) continue;
		const district = world.grid.cellsById.get(a.id)?.block ?? road.block;
		const crown = Math.max(...[...road.corners, ...route.corners].map((p) => p[2])) + HOCHWEG_M;
		const obstacle = gateBlocker(world, [road, route], crown, id);
		const bearingTooHigh = Math.max(a.foot[2], b.foot[2]) >= crown;
		seams.set(id, {
			id,
			vertices,
			houses: [a.id, b.id],
			use: kind === 'mainAlley' ? 'frontage' : 'shore',
			district,
			character: characters.get(district) ?? 'neutral',
			districtEdge: false,
			gate: true,
			transverse: kind,
			adjacentCharacter: characters.get(world.grid.cellsById.get(b.id)?.block ?? road.block),
			opening: obstacle ? 'gate-clearance' : bearingTooHigh ? 'gate-bearing-height' : undefined,
			blocker: obstacle ?? road.id,
			intent: world.state.frameIntents?.get(id)
		});
		bays.set(id, {
			id,
			a: a.foot,
			b: b.foot,
			back: a.shoes[0],
			gateShoes: [...a.shoes, ...b.shoes],
			clearVolumes: [road, route].map((cell) => {
				const z = Math.min(...cell.corners.map((p) => p[2]));
				return { z, hoeheM: crown - z, polygon: cell.corners.map(([x, y]) => [x, y]) };
			}),
			clearances: [...new Set([...road.neighbors, ...route.neighbors])].flatMap((n) => {
				if (!n || [a.id, b.id, road.id, route.id].includes(n)) return [];
				const c = world.grid.cellsById.get(n);
				return c &&
					(c.zone === 'water' || c.plan.square || c.plan.kind || world.state.stacks.has(n))
					? [c.corners]
					: [];
			}),
			crown
		});
	}
}
