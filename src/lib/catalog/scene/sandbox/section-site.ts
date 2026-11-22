import type { World } from '../../logic/sandbox';
import type { Vec3 } from '../../logic/parametrik/types';

const LOCAL_SECTION_SPAN_M = 120;
const SECTION_HEADROOM_M = 30;

/** Places a fixed transect through the waterfront landmark and the nearby river bed. */
export function sectionSite({ grid, state }: World) {
	const towerId = state.city?.centres.find(({ landmark }) => landmark.object === 'water-tower')
		?.landmark.cellId;
	const tower = towerId && grid.cellsById.get(towerId);
	const bridge = grid.cells.find((cell) => cell.plan.footbridge && cell.zone === 'water');
	const station = tower || bridge || grid.cells[Math.floor(grid.cells.length / 2)];
	const wet = grid.cells.filter((cell) => cell.column === station.column && cell.zone === 'water');
	const [x, y, z] = station.center;
	const waterY = wet[Math.floor(wet.length / 2)]?.center[1] ?? y;
	const center: Vec3 = [x, (y + waterY) / 2, z];
	const reachM = Math.max(LOCAL_SECTION_SPAN_M, Math.abs(y - waterY) + 81) / 2;
	return { center, reachM, topM: Math.max(z, grid.terrain.waterLevel) + SECTION_HEADROOM_M };
}
