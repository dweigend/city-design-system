import { expect, test } from 'bun:test';
import { defaults } from '../../../config/house-site';
import { measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { houseFigures } from '../../domain/house-court';
import { createParcelHouse, createParcelHouseObject, createTownHouseStudy } from './index';

const inputs = { height: 14, width: 28, complexity: 0.6, seed: 3 };

function groundProbes(polygon: readonly Vec2[]): Vec2[] {
	const mids = polygon.map(([x, y], i): Vec2 => {
		const [u, v] = polygon[(i + 1) % polygon.length];
		return [(x + u) / 2, (y + v) / 2];
	});
	return [...polygon, ...mids, required(measurePolygon(polygon).centroid, 'plate centroid')];
}

for (const relief of [0, 0.5, 1])
	test(`every private parcel at town relief ${relief} is buildable or reports why`, () => {
		const town = createTownHouseStudy({ relief });
		const { blocks, holdings, portals, columns, layout, groundAt } = town;
		expect(blocks.block.laneIds.some((id) => blocks.neighbour.laneIds.includes(id))).toBe(true);
		const byId = new Map(holdings.blocks.map((block) => [block.id, block]));
		const counts = { parcels: 0, placed: 0, unbuildable: 0 };
		const reasons = new Map<string, number>();
		const failures: string[] = [];
		for (const parcel of holdings.parcels) {
			if (parcel.publicUse) continue;
			counts.parcels += 1;
			const placed = createParcelHouse(
				{
					parcel,
					portal: required(portals.get(parcel.portalId), 'parcel portal'),
					block: required(byId.get(parcel.blockId), 'parcel block'),
					columns,
					datumZ: layout.datumZ,
					linearToleranceM: holdings.linearToleranceM,
					groundAt,
					scale: 'by-area'
				},
				inputs
			);
			if (placed.status === 'unbuildable') {
				counts.unbuildable += 1;
				reasons.set(placed.reason, (reasons.get(placed.reason) ?? 0) + 1);
				continue;
			}
			counts.placed += 1;
			const { space, house } = placed;
			const figures = houseFigures(space, house);
			if (!figures.builtCells) failures.push(`empty ${parcel.id}`);
			if (figures.storeys > space.storeyCount) failures.push(`over cap ${parcel.id}`);
			const object = createParcelHouseObject(placed, 'block');
			const entrance = object.anchors.find(({ name }) => name === 'entrance')?.position;
			if (!entrance) failures.push(`missing entrance ${parcel.id}`);
			else {
				const [x, y, z] = entrance;
				if (Math.abs(z - groundAt([x, y])) > defaults.groundToleranceM + Number.EPSILON)
					failures.push(`entrance height ${parcel.id}`);
			}
			const floating = object.parts.some(
				({ shape, slot }) =>
					(slot === 'plot' || slot === 'court') &&
					shape.kind === 'prism' &&
					groundProbes(shape.polygon).some(
						(point) => shape.base > groundAt(point) + defaults.groundToleranceM
					)
			);
			if (floating) failures.push(`floating plate ${parcel.id}`);
		}
		console.log('Town parcel sweep', { relief, ...counts, reasons: Object.fromEntries(reasons) });
		expect(counts.placed + counts.unbuildable).toBe(counts.parcels);
		expect(counts.placed).toBeGreaterThan(2000);
		expect(failures).toEqual([]);
	}, 120000);
