import { terrainHeight } from '../terrain';
import { required } from '../required';
import { coord } from './block-graph';
import type { FittedPatch } from './fit-patch';
import type { Lattice } from './contour-rows';
import { carrierSite } from './alley-plan';
import { hasFront } from './parcel-access';
import { cellId, type TerrainCell } from './types';

function frontageOn(patch: FittedPatch, lattice: Lattice, x: number, y: number) {
	const sites = new Map<string, Parameters<typeof hasFront>[0]>();
	const lookup = (id: string) => {
		const old = sites.get(id);
		if (old) return old;
		const face = required(patch.faces.get(id), 'court carrier');
		const corner = (i: number): TerrainCell['center'] => {
			const xy = required(patch.positions.get(cellId(...face.vertices[i])), 'court vertex');
			return [xy[0], xy[1], terrainHeight(lattice.terrain, ...xy)];
		};
		const corners = [corner(0), corner(1), corner(2), corner(3)] as const;
		const [c, r] = coord(id);
		const { plan } = carrierSite(lattice, x + c, y + r, corners);
		const site = {
			id,
			corners,
			plan,
			alleyEdges: face.block.mask,
			neighbors: face.neighbors.map((n) => (n ? cellId(...n) : null))
		};
		sites.set(id, site);
		return site;
	};
	return (id: string) => hasFront(lookup(id), lookup, lattice.profile.alleyWidth);
}

/** Admit one court at a time. Failed trials cannot move a shared point or displace an earlier cut. */
export function planCourts(
	lattice: Lattice,
	x: number,
	y: number,
	fit: (allowed: ReadonlySet<string>) => FittedPatch
) {
	const accepted = new Set<string>();
	let patch = fit(accepted);
	const candidates = patch.candidates;
	let hasAccess = frontageOn(patch, lattice, x, y);
	const valid = (id: string, trial: FittedPatch, front: (slot: string) => boolean) =>
		[...required(candidates.get(id), 'court proposal')].every(
			([leaf, slots]) =>
				slots.every((slot) => trial.faces.get(slot)?.block.parcel === leaf) && slots.some(front)
		);
	for (const [id, children] of candidates) {
		if (
			![...children.values()].every(
				(slots) =>
					slots.every((slot) => patch.faces.get(slot)?.block.parcel === id) && slots.some(hasAccess)
			)
		)
			continue;
		const next = new Set([...accepted, id]);
		const trial = fit(next);
		const front = frontageOn(trial, lattice, x, y);
		if (![...next].every((block) => valid(block, trial, front))) continue;
		accepted.add(id);
		patch = trial;
		hasAccess = front;
	}
	const access = new Map<string, NonNullable<TerrainCell['parcelAccess']>>();
	for (const id of accepted) access.set(id, 'fronted');
	for (const [slot, { block }] of patch.faces) {
		if (block.parcel !== block.id || access.get(block.id) === 'fronted') continue;
		access.set(block.id, hasAccess(slot) ? 'fronted' : 'landlocked');
	}
	return { ...patch, access };
}

/** Surveys sky-open courts enclosed by four dry building plots of the same old-town district.
 * Keep one court per carrier block and keep the surrounding plots on the frontage. */
export function surveyEnclosedCourts(
	cells: ReadonlyMap<string, TerrainCell>,
	oldTown: ReadonlySet<string>,
	paths: ReadonlySet<string>,
	occupied: ReadonlySet<string>
) {
	const found = new Map<
		string,
		{ court: TerrainCell; enclosure: TerrainCell[]; frontage: number }
	>();
	for (const id of oldTown) {
		const court = cells.get(id);
		if (!court || occupied.has(id)) continue;
		const enclosure = court.neighbors.flatMap((side) => {
			const cell = side === null ? undefined : cells.get(side);
			return cell && oldTown.has(cell.id) && !occupied.has(cell.id) ? [cell] : [];
		});
		if (enclosure.length !== 4) continue;
		const frontage = enclosure.filter((cell) =>
			cell.neighbors.some((n) => n !== null && paths.has(n))
		).length;
		if (!frontage) continue;
		const previous = found.get(court.block);
		if (
			previous &&
			(previous.frontage > frontage ||
				(previous.frontage === frontage && previous.court.index < court.index))
		)
			continue;
		found.set(court.block, { court, enclosure, frontage });
	}
	const reserved = new Set<string>();
	const walls = new Set<string>();
	const courts = [];
	const ordered = [...found.entries()].sort(([, a], [, b]) => a.court.index - b.court.index);
	for (const [block, { court, enclosure }] of ordered) {
		if (walls.has(court.id) || enclosure.some(({ id }) => reserved.has(id))) continue;
		reserved.add(court.id);
		for (const { id } of enclosure) walls.add(id);
		courts.push({ block, court: court.id, enclosure: enclosure.map(({ id }) => id) });
	}
	return courts;
}
