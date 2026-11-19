import { physicalRuns } from './frame-runs';
import { squareShares } from './frame-clearance';
import { bayAxes, interiorLength } from '../megastructure';
import type { OmissionEvidence } from '../district-frame';
import { frameSurvey } from './frame-survey';
import type { World } from './world';
import type { Vec3 } from '../parametrik/types';

type Segment = readonly [Vec3, Vec3];
const length = ([a, b]: Segment) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tangent = ([a, b]: Segment) => [
	(b[0] - a[0]) / length([a, b]),
	(b[1] - a[1]) / length([a, b])
];

/** Computes evidence on demand from the complete snapshot; interactive solving does not read this report. */
export function frameReport(world: World) {
	const survey = frameSurvey(world, true),
		{ seams, bays, rules } = survey;
	const stock = world.state.frameBays ?? new Map();

	const perimeter = new Map<string, number>(),
		occupied = new Map<string, number>();
	const node = new Map<string, string[]>(),
		diagnostics = new Map<string, OmissionEvidence>();
	const main = new Set([...stock].filter(([, d]) => d.built === 'main').map(([id]) => id));
	const square = squareShares(world.grid, main);
	const routeLength = new Map<string, number>(),
		gatedBlocks = new Set<string>();
	for (const cell of world.grid.cells) {
		if (cell.plan.kind === 'mainAlley' || cell.plan.kind === 'riversidePromenade') {
			const dir = cell.plan.direction;
			const across = length([cell.corners[0], cell.corners[3]]);
			const along = length([cell.corners[0], cell.corners[1]]);
			routeLength.set(
				cell.block,
				(routeLength.get(cell.block) ?? 0) +
					(dir === 'along' ? along : dir === 'across' ? across : along + across)
			);
		}
		for (const [i, n] of cell.neighbors.entries()) {
			if (n && world.grid.cellsById.get(n)?.block === cell.block) continue;
			const distance = length([cell.corners[i], cell.corners[(i + 1) % 4]]);
			perimeter.set(cell.block, (perimeter.get(cell.block) ?? 0) + distance);
			const id = JSON.stringify([cell.vertexIds[i], cell.vertexIds[(i + 1) % 4]].sort());
			if (main.has(id)) occupied.set(cell.block, (occupied.get(cell.block) ?? 0) + distance);
		}
	}
	let gateCount = 0;
	for (const [id, seam] of seams) {
		const bay = bays.get(id);
		if (!bay) continue;
		const active = !!stock.get(id)?.built;
		const span = bayAxes(bay).axes[2];
		const boundary = perimeter.get(seam.district) ?? 0;
		let water = 0,
			plaza = 0;
		const touched = new Set(
			seam.houses.flatMap((h) => [h, ...(world.grid.cellsById.get(h)?.neighbors ?? [])])
		);
		for (const cellId of touched) {
			const c = cellId && world.grid.cellsById.get(cellId);
			if (!active || !c) continue;
			const inside = interiorLength(span[0], span[1], c.corners);
			if (c.zone === 'water') water += inside;
			if (c.plan.square) plaza += inside;
		}
		if (active && seam.gate) {
			const road = seam.blocker && world.grid.cellsById.get(seam.blocker);
			if (road) gatedBlocks.add(road.block);
		}
		diagnostics.set(id, {
			'water-crossing': water,
			'square-interior': plaza,
			...(square.has(id) ? { enclosure: square.get(id) } : {}),
			'interior-main': Number(main.has(id) && seam.use === 'houses' && !seam.districtEdge),
			'path-opening': Number(active && seam.opening === 'passage'),
			'scarp-bearing': active
				? seam.houses.filter((h) => world.grid.cellsById.get(h)?.zone === 'scarp').length
				: 0,
			'chord-height': active ? Math.abs(span[0][2] - span[1][2]) : 0,
			...(boundary ? { 'block-share': (occupied.get(seam.district) ?? 0) / boundary } : {})
		});
		if (!main.has(id)) continue;
		if (seam.gate) gateCount++;
		for (const v of seam.vertices) {
			const list = node.get(v) ?? [];
			list.push(id);
			node.set(v, list);
		}
	}
	const { lengths, longestRun } = physicalRuns(main, world.state.frameInstallations);
	for (const [id, n] of lengths) {
		const row = diagnostics.get(id);
		if (row) row['run-length'] = n;
	}
	for (const [id, s] of seams) {
		const d = diagnostics.get(id),
			bay = bays.get(id);
		if (!d || !bay || !main.has(id)) continue;
		const queue = [id],
			distance = new Map([[id, 0]]),
			axis = tangent([bay.a, bay.b]);
		// Cell separation is the shortest side-neighbour path between supporting parcels.
		const cells = s.houses.slice(),
			steps = new Map(cells.map((h) => [h, 0]));
		for (let i = 0; i < cells.length; i++) {
			const h = cells[i],
				depth = steps.get(h) ?? 0;
			for (const n of world.grid.cellsById.get(h)?.neighbors ?? [])
				if (n && !steps.has(n)) {
					steps.set(n, depth + 1);
					cells.push(n);
				}
		}
		const blocks = new Set<string>();
		for (let i = 0; i < queue.length; i++) {
			const current = seams.get(queue[i]);
			if (!current) continue;
			blocks.add(current.district);
			for (const v of current.vertices)
				for (const candidate of node.get(v) ?? []) {
					if (distance.has(candidate)) continue;
					const b = bays.get(candidate);
					if (!b) continue;
					const dir = tangent([b.a, b.b]);
					if (Math.abs(axis[0] * dir[1] - axis[1] * dir[0]) > 1e-8) continue;
					distance.set(candidate, i);
					queue.push(candidate);
				}
		}
		d['straight-blocks'] = blocks.size;
		let nearest = Infinity;
		for (const k of main) {
			const other = seams.get(k),
				b = bays.get(k);
			if (!other || !b || other.vertices.some((v) => s.vertices.includes(v))) continue;
			const dir = tangent([b.a, b.b]);
			if (Math.abs(axis[0] * dir[1] - axis[1] * dir[0]) > 1e-8) continue;
			for (const h of other.houses) nearest = Math.min(nearest, steps.get(h) ?? Infinity);
		}
		if (Number.isFinite(nearest)) d['parallel-distance'] = nearest;
	}
	for (const [id, seam] of seams) {
		const d = diagnostics.get(id),
			total = routeLength.get(seam.district);
		if (d && total && !gatedBlocks.has(seam.district)) d['alley-cover'] = 0;
	}
	const blocks = new Set(world.grid.cells.map((c) => c.block));
	return {
		longestRun,
		quiet: [...blocks].filter((id) => survey.characters.get(id) === 'quiet').length,
		total: blocks.size,
		unclassified: [...blocks].filter((id) => survey.characters.get(id) === 'neutral'),
		gateCount,
		quietDistrictShare: blocks.size
			? [...blocks].filter((id) => survey.characters.get(id) === 'quiet').length / blocks.size
			: null,
		districtMainShare: new Map([...perimeter].map(([id, p]) => [id, (occupied.get(id) ?? 0) / p])),
		explain: (id: string) => ({
			...rules.explain(id, stock, world.seed, diagnostics.get(id)),
			planning: world.state.frameTimeline?.results.filter(
				(r) => r.literal === id || r.phases.some((p) => p.seam === id)
			),
			structure: world.state.frameInstallations?.get(id)?.result
		})
	};
}
