import { frameInfill } from '../district-frame';
import { atSocket, socketBounds } from '../house-brush';
import { dockStock } from './dock-stock';
import type { FrameInstallation } from './frame-state';
import type { BuiltPart, PartId } from './installation-parts';
import type { World } from './world-contract';

const TANK_SLOT = -1;
const TANK_STATION = 0.5;
const TANK_SHELL_PITCH_M = 1.5;

/** Fits the weighted infill on new bays only, reserving each successful seat for this tick. */
export function installFrameInfill(
	world: World,
	newBays: readonly string[],
	year: number,
	parts: Map<PartId, BuiltPart>,
	frameInstallations: ReadonlyMap<string, FrameInstallation>
): void {
	if (!newBays.length) return;
	const { rods, occupied } = dockStock({
		...world,
		state: { ...world.state, parts, frameInstallations }
	});
	const byId = new Map(rods.map((rod) => [rod.part.id, rod]));
	for (const seam of [...newBays].sort()) {
		if (frameInfill(world.seed, seam, world.state.futureTarget) !== 'tank') continue;
		const rod = byId.get(`tg/${seam}/2`);
		if (rod?.part.recipe !== 'chord' || rod.part.frame?.gate) continue;
		const seat = atSocket(
			rod,
			TANK_STATION,
			'tank',
			[...occupied, ...rods.filter((other) => other !== rod)],
			TANK_SHELL_PITCH_M
		);
		if (!seat) continue;
		occupied.push(...socketBounds(seat));
		const id: PartId = `tg/${seam}/${TANK_SLOT}`;
		parts.set(id, {
			id,
			owner: rod.part.owner,
			kind: 'module',
			recipe: 'tank',
			fit: 'profile-v1',
			anchor: rod.part.anchor,
			attachedTo: rod.part.id,
			share: TANK_STATION,
			pitch: TANK_SHELL_PITCH_M,
			built: year,
			flow: 'water',
			materials: {}
		});
	}
}
