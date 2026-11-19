import { trimBay, type BaySurvey } from '../megastructure';
import type { FrameInstallation } from './frame-state';
import { frameSurvey } from './frame-survey';
import type { World } from './world-contract';

/** A bay is certified independently of simultaneous proposals. Its rods must also fit
 * if every other frontage on its supporting parcels stays open. */
export function sizingSites(world: World) {
	const survey = frameSurvey(world);
	const gaps = new Map([...survey.bays.keys()].map((id) => [id, { role: 'gap' }]));
	const sites: BaySurvey[] = [];
	for (const seam of survey.seams.values()) {
		if (seam.opening || world.state.frameBays?.get(seam.id)?.built === 'main') continue;
		const bay = survey.supportedBay(seam.id, gaps);
		if (bay) sites.push(bay);
	}
	return sites;
}

/** Sizes a detached batch. The worker and synchronous replay use this same calculation. */
export function sizeFrameSites(
	sites: readonly BaySurvey[],
	drawing: Parameters<typeof trimBay>[1] = 'service'
) {
	return new Map<string, FrameInstallation>(
		sites.map((bay) => [bay.id, { bay, result: trimBay(bay, drawing) }])
	);
}
