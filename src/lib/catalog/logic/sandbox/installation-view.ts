import { buildingPlots } from './building-plots';
import { atSocket, carrierForm, shellForms } from '../house-brush';
import { FRAME_DIAMETER, LANDING_RADIUS_M, moduleBridge } from '../megastructure';
import { WALKWAY_WIDTH_M } from '../walkway';
import { levelFor, present, type FocusId } from '../presentation';
import { flowToken } from '../../data/focus';
import type { Primitive, Vec3 } from '../parametrik/types';
import { position, type BuiltPart } from './installation-parts';
import { rodOf } from './dock-stroke';
import type { World } from './world';

const base = (id: string) => ({ id, token: '--paper', role: 'neu', material: 'metal' }) as const;
function moduleView(world: World, p: Extract<BuiltPart, { kind: 'module' }>): Primitive[] {
	const support = world.state.parts.get(p.attachedTo);
	const rod = support && rodOf(buildingPlots(world.grid), support);
	const m = rod && atSocket(rod, p.share, p.recipe, [], p.pitch);
	if (!m) return [];
	return shellForms(p.id, p.recipe, m);
}

function segmentView(
	world: World,
	p: Extract<BuiltPart, { kind: 'segment' }>,
	a: Vec3
): Primitive[] {
	const end = position(world.grid, p.end);
	const rod = rodOf(buildingPlots(world.grid), p);
	if (rod) return [carrierForm(p.id, rod, p.recipe === 'chord')];
	if (p.recipe === 'stair') {
		const run = Math.hypot(end[0] - a[0], end[1] - a[1]);
		const dx = ((end[0] - a[0]) * LANDING_RADIUS_M) / run,
			dy = ((end[1] - a[1]) * LANDING_RADIUS_M) / run;
		a[0] += dx;
		a[1] += dy;
		end[0] -= dx;
		end[1] -= dy;
	}
	return moduleBridge(a, end, p.id).map((form) => ({
		...form,
		...(form.kind === 'polyline' ? { stroke: 'brace' as const, detail: true } : {}),
		token: p.recipe === 'stair' ? '--cat-business-3' : flowToken.people
	}));
}

function partView(world: World, p: BuiltPart): Primitive[] {
	if (p.kind === 'module') return moduleView(world, p);
	const a = position(world.grid, p.anchor);
	const b = base(p.id);
	if (p.kind === 'segment') return segmentView(world, p, a);
	if (p.kind === 'pillar') {
		const node = p.recipe === 'bearing' ? position(buildingPlots(world.grid), p.anchor) : a;
		const dot: Primitive = {
			...b,
			id: p.id + '/joint',
			kind: 'sphere',
			position: node,
			radius: 0.25,
			shade: 1,
			edges: false
		};
		if (p.recipe === 'bearing') return [dot];
		const ground =
			world.grid.cellsById.get(p.anchor.cellId)?.corners[p.anchor.vertex ?? 0][2] ?? a[2];
		return [
			carrierForm(p.id, { a: [a[0], a[1], ground], b: a, radius: FRAME_DIAMETER.main / 2 }, true),
			dot
		];
	}
	const width = p.recipe === 'plaza' ? 2 * WALKWAY_WIDTH_M : WALKWAY_WIDTH_M;
	return [
		{
			...b,
			kind: 'box',
			position: [a[0] - width / 2, a[1] - width / 2, a[2] - 0.25],
			size: [width, width, 0.25],
			token: p.recipe === 'plaza' ? '--cat-business-2' : '--cat-business-3'
		}
	];
}

/** Projects each installed part from its saved address at its own construction date. */
export function installationView(world: World, focus: FocusId): Primitive[] {
	return [...world.state.parts.values()].flatMap((p) => {
		const system = world.state.compositions.get(p.owner)?.system ?? 'houses';
		return present(partView(world, p), levelFor(focus, system, p.built, world.state.year));
	});
}
