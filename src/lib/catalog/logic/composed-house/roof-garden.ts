import { ringArea } from '../quad-grid';
import { roomOnDeck } from '../house-typology';
import { place } from './asset-fit';
import { houseObject, type StockPart } from './house-object';
import type { SectionSurfaces } from './surfaces';
import type { Section } from './types';

type Roof = Extract<StockPart, { kind: 'prism' }>;
type Reservation = { x: number; y: number; w: number; d: number };
function overlaps(a: Reservation, b: Reservation) {
	return Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.d + b.d;
}
function reserved(section: Section, z: number) {
	const { people, crown, sharedRoof } = section.composition;
	const obstacles = people
		.filter((p) => Math.abs(p.position[2] - z) < 0.01)
		.map(({ position: [x, y] }) => ({ x, y, w: 0.65, d: 0.65 }));
	if (sharedRoof !== 'terrace')
		obstacles.push({
			x: crown.position[0],
			y: crown.position[1],
			w: crown.size[0] / 2,
			d: crown.size[1] / 2
		});
	return obstacles;
}
// Leave at least eighteen square metres of walkable terrace per additional trough.
function bedCapacity(roof: Roof) {
	const usableArea =
		Math.abs(ringArea(roof.polygon)) -
		(roof.holes ?? []).reduce((sum, h) => sum + Math.abs(ringArea(h)), 0);
	return Math.max(1, Math.min(3, Math.floor(usableArea / 18)));
}

function bedsOn(section: Section, roof: Roof) {
	const xs = roof.polygon.map(([x]) => x),
		ys = roof.polygon.map(([, y]) => y);
	const obstacles = reserved(section, roof.z + roof.height);
	const capacity = bedCapacity(roof);
	const beds: Reservation[] = [];
	for (let x = Math.min(...xs) + 0.45; x < Math.max(...xs); x += 0.5)
		for (let y = Math.min(...ys) + 0.45; y < Math.max(...ys); y += 0.5) {
			const bed = [
				{ x, y, w: 0.98, d: 0.28 },
				{ x, y, w: 0.28, d: 0.98 }
			].find(
				(b) =>
					roomOnDeck(roof.polygon, roof.holes ?? [], x, y, b.w + 0.12, b.d + 0.12) &&
					obstacles.every((o) => !overlaps(o, b))
			);
			if (!bed) continue;
			beds.push(bed);
			if (beds.length === capacity) return beds;
			obstacles.push({ ...bed, w: bed.w + 0.5, d: bed.d + 0.5 });
		}
	return beds;
}
/** Seats full-size planted troughs on clear roof area, allowing for the ladder, crown and residents. */
export function roofGarden(section: Section, roof: Roof, surfaces: SectionSurfaces) {
	return bedsOn(section, roof).flatMap(({ x, y, w, d }, i) => {
		const stock = houseObject('kit-terrace-planter', 'long', section.seed, {
			instanceId: section.id + '/roof/furniture/bed/' + i,
			slots: { body: surfaces.deck, planting: surfaces.food }
		});
		return place(
			stock.parts,
			[0, 0, 0],
			[x, y, roof.z + roof.height],
			[1, 1, 1],
			w > d ? 0 : Math.PI / 2
		).map((p) => ({
			...p,
			structuralRole: 'occupant' as const,
			carrier: roof.id
		}));
	});
}
