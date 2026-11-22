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
