import { sizeFrameSites, sizingSites } from './frame-sizing';
import type { BaySurvey } from '../megastructure';
import { planFrames, recordPlans, initialTimeline } from './frame-planning';
import { advanceSeams, compileSeams, type BayState } from '../district-frame';
import type { PartId, Owner, BuiltPart } from './installation-parts';
import { installFrameInfill } from './frame-infill';
import { frameSurvey } from './frame-survey';
import type { World } from './world-contract';

import type { FrameInstallation } from './frame-state';

function installMembers(
	world: World,
	seam: string,
	house: string,
	bay: BaySurvey,
	result: Extract<FrameInstallation['result'], { status: 'sized' }>,
	year: number,
	parts: Map<PartId, BuiltPart>
) {
	const owner: Owner = `tg/${seam}`;
	const anchor = { cellId: house, level: world.state.stacks.get(house)?.length ?? 0, lift: 0 };
	for (const member of result.rods) {
		const id: PartId = `tg/${seam}/${Number(member.id)}`;
		parts.set(id, {
			kind: 'segment',
			recipe: member.id === '2' ? 'chord' : 'brace',
			id,
			owner,
			anchor,
			end: anchor,
			built: year,
			materials: {},
			frame: { seam, gate: !!bay.gateShoes, member }
		});
	}
	return owner;
}
/** Commits only feasible matured bays. Stored axes and sections are the replay authority. */
export function advanceFrames(
	world: World,
	year: number,
	region?: readonly string[],
	proofs = sizeFrameSites(sizingSites(world))
) {
	const survey = frameSurvey(world),
		prior = world.state.frameBays ?? new Map<string, BayState>();
	const timeline = world.state.frameTimeline ?? initialTimeline;
	const planning = planFrames(world, survey, timeline, year, proofs);
	const rules =
		timeline.goals.length || timeline.controls.observations.length
			? compileSeams(planning.seams)
			: survey.rules;
	const installations = new Map(world.state.frameInstallations);

	const parts = new Map(world.state.parts),
		compositions = new Map(world.state.compositions);
	const { state: stock } = advanceSeams(
		rules,
		region ? [...region] : [...survey.seams.keys()],
		prior,
		world.seed,
		{ tick: planning.tick, year },
		(id) => {
			const proof = proofs.get(id);
			if (proof?.result.status === 'rejected' && (!region || region.includes(id)))
				installations.set(id, proof);
			return proof?.result.status === 'sized';
		}
	);
	const newBays: string[] = [];
	for (const id of region ?? survey.seams.keys()) install(id);
	installFrameInfill(world, newBays, year, parts, installations);
	function install(id: string) {
		const role = stock.get(id)?.built;
		if (!role || role === prior.get(id)?.built) return;
		const installation = proofs.get(id);
		if (installation?.result.status !== 'sized') return;
		installations.set(id, installation);
		const house = survey.seams.get(id)?.houses[0];
		if (!house) return;
		const owner = installMembers(
			world,
			id,
			house,
			installation.bay,
			installation.result,
			year,
			parts
		);
		compositions.set(owner, { id: owner, system: 'houses' });
		if (!prior.get(id)?.built && world.state.futureTarget) newBays.push(id);
	}
	const frameIntents = new Map(world.state.frameIntents);
	for (const seam of planning.seams) if (seam.intent) frameIntents.set(seam.id, seam.intent);
	return {
		...(parts.size !== world.state.parts.size ? { parts, compositions } : {}),
		frameBays: stock,
		frameInstallations: installations,
		frameIntents,
		frameTimeline: recordPlans(timeline, planning.plans, planning.tick, stock, prior)
	};
}
