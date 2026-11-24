/** Module: Adapts city lattices to structural graphs and gravity loads. */
import { defaults } from '../../../config/city-structure';
import type { Vec3 } from '../../core/geometry';
import { defineParams } from '../../core/params';
import { required } from '../../core/invariant';
import type { CityLattice } from '../../domain/city-volume';
import { createMemberGraph } from '../../domain/structure';
import { tributaryForces } from './loads';
import { primarySection, shellEdges } from './shell';

/** Density and shell selection settings, including units and reasons. */
export { settings as cityStructureSettings } from '../../../config/city-structure';

const [min, nominal, max, step] = defaults.loadIntensityPercent;
/** Scales the demo gravity case as a share of nominal, with bounded steps in percent. */
export const structureLoadParams = defineParams({
	intensity: { label: 'Load intensity (%)', unit: '%', min, max, default: nominal, step }
});

/** Reads beam, column or brace from lattice rank and endpoint direction. */
function memberRole(a: Vec3, b: Vec3, chord: boolean) {
	const rise = Math.abs(b[2] - a[2]);
	if (chord || rise === 0) return 'beam';
	const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
	return run <= defaults.uprightRunPerRise * rise ? 'column' : 'brace';
}

/** Adapts each lattice joint and edge once, keeping their IDs. Ground contacts are pinned.
 * Exposed solid edges carry the primary frame. Loads in kN come from the same lattice solids.
 * Returns a detached frozen graph and load list. Invalid graph geometry throws RangeError. */
export function createCityStructure(lattice: CityLattice, datumZ: number) {
	if (!Number.isFinite(datumZ)) throw new RangeError('Expected a finite structural datum');
	const nodes = new Map(lattice.nodes.map((node) => [node.id, node]));
	const shell = shellEdges(lattice, nodes);
	const graph = createMemberGraph({
		joints: lattice.nodes.map(({ id, position, groundContact }) => ({
			id,
			position,
			support: groundContact ? 'pinned' : 'free'
		})),
		members: lattice.edges.map(({ id, from, to, rank }) => {
			const a = required(nodes.get(from), 'member joint');
			const b = required(nodes.get(to), 'member joint');
			const role = memberRole(
				a.position,
				b.position,
				rank === 'chord' || (a.groundContact === true && b.groundContact === true)
			);
			const section = primarySection(shell.get(id), role, a.position[2], datumZ);
			return { id, from, to, role, section };
		})
	});
	return Object.freeze({ graph, loads: Object.freeze(tributaryForces(lattice, nodes)) });
}

/** Fixed default-town and largest-city study inputs. */
export { structureTownExample, largestStructureExample } from './example';
