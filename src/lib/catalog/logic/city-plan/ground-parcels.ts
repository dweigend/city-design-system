import { required } from '../required';
import type { TerrainCell } from '../terrain-grid';
import type { GroundPlot } from './ground-districts';

export type AddressedPlot = GroundPlot & Readonly<{ parcel: string; block: string }>;

/** Groups plots by side contact within a carrier parcel, block and plot kind. */
export function addressGroundPlots(
	planId: string,
	land: ReadonlyMap<string, TerrainCell>,
	plots: ReadonlyMap<string, GroundPlot>
): ReadonlyMap<string, AddressedPlot> {
	const addressed = new Map<string, AddressedPlot>();
	for (const id of [...plots.keys()].sort()) {
		if (addressed.has(id)) continue;
		const start = required(land.get(id), 'plot ground cell');
		const plot = required(plots.get(id), 'ground plot');
		const parcel = `${planId}/parcel/${id}`;
		const block = `${planId}/block/${start.block}`;
		const members = [start];
		addressed.set(id, { ...plot, parcel, block });
		for (const cell of members) {
			for (const neighborId of cell.neighbors) {
				if (neighborId === null || addressed.has(neighborId)) continue;
				const neighborPlot = plots.get(neighborId);
				if (neighborPlot?.kind !== plot.kind) continue;
				const neighbor = required(land.get(neighborId), 'plot ground cell');
				if (neighbor.parcel !== start.parcel || neighbor.block !== start.block) continue;
				addressed.set(neighborId, { ...neighborPlot, parcel, block });
				members.push(neighbor);
			}
		}
	}
	return addressed;
}
