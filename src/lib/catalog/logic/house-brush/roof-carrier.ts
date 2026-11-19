import type { Primitive, Vec3 } from '../parametrik/types';
import { inradius, type QuadCell } from '../quad-grid';
import { part, type Site } from './form';
import { floorOf, type Mass } from './massing';
import { along, bayOf } from './megastructure-bay';
import { storiesOf, type Stacks } from './stacks';
import type { PrintOrder } from './print-contact';
import { BODY_TOKEN } from '../../data/house-body';
import { dockedModule } from './style-totem';
import type { Ensembles } from './ensemble';

export type RoofContext = {
	occupied: Stacks;
	printOrder?: PrintOrder;
	ensembles?: Ensembles;
	blockOf: (id: string) => string | undefined;
	olderRoof: (id: string) => boolean;
};
const CARRIER = {
	clearance: 1.45,
	girderDepth: 0.32,
	pierInset: 0.12,
	chordRadius: 0.04,
	graphite: 0.55
};

/** Straightest local run in the grid topology, bounded by the anchor's two side neighbors. */
function roofRun(site: Site, anchor: QuadCell, context: RoofContext) {
	const flank = (side: number) => {
		const id = anchor.neighbors[side];
		if (!id || !context.olderRoof(id)) return [];
		const cell = site.grid.cellsById.get(id);
		return cell && context.blockOf(id) === context.blockOf(anchor.id) ? [cell] : [];
	};
	return [0, 1]
		.map((side) => ({
			side,
			cells: [...flank(side), anchor, ...flank(side + 2)]
		}))
		.sort((a, b) => b.cells.length - a.cells.length)[0];
}

/** A continuous shallow truss with a suspended ceramic cartridge above each neighboring roof. */
export function roofCarrier(site: Site, mass: Mass, context: RoofContext): Primitive[] {
	const { cell, level } = mass.stories[0];
	if (storiesOf(site.stacks, cell.id).length !== level + 1) return [];
	const run = roofRun(site, cell, context);
	if (run.cells.length < 2) return [];
	const roofs = run.cells.map((c) => floorOf(c, storiesOf(site.stacks, c.id).length));
	const floor = Math.max(...run.cells.map((c, i) => roofs[i] + inradius(c) * CARRIER.clearance));
	const carrier = { ...mass, id: mass.id + ':span', floor };
	const low: Vec3[] = [],
		high: Vec3[] = [],
		parts: Primitive[] = [];
	const trace = (
		suffix: string,
		points: Vec3[],
		bearings?: Vec3[],
		member?: Primitive['member']
	): Primitive => ({
		...part(carrier.id + '/' + suffix, '--paper', { kind: 'polyline', points }),
		role: 'traeger',
		bearings,
		member
	});
	for (const [i, c] of run.cells.entries()) {
		const bay = bayOf(carrier, { cell: c, level }, [...c.corners]);
		const foot = bay.point(0.5, 0.5, 1);
		low.push(foot);
		high.push([foot[0], foot[1], foot[2] + inradius(c) * CARRIER.girderDepth]);
		const joint = along(bay, run.side, CARRIER.pierInset, 0.5, 1);
		const bearing: Vec3 = [joint[0], joint[1], roofs[i]];
		parts.push(trace('bent/' + c.id, [bearing, joint, foot], [bearing]));
		if (i)
			parts.push(
				trace('brace/' + i, [low[i - 1], high[i]], undefined, i % 2 ? 'secondary' : 'alternate')
			);
		if (c !== cell) parts.push(...dockedModule(bay, run.side, BODY_TOKEN[mass.use]));
	}
	const chord: Primitive = {
		...part(carrier.id + '/lower', '--paper', {
			kind: 'pipe',
			points: low,
			radius: Math.min(...run.cells.map(inradius)) * CARRIER.chordRadius,
			edges: false,
			shade: CARRIER.graphite
		}),
		role: 'traeger',
		legacyRole: 'neu'
	};
	return [...parts, chord, trace('upper', high)];
}
