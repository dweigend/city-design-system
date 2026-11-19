import { buildingPlots } from './building-plots';
import { carrierForm, shellForms } from '../house-brush';
import { FRAME_DIAMETER, LANDING_RADIUS_M, moduleBridge } from '../megastructure';
import { WALKWAY_WIDTH_M } from '../walkway';
import { levelFor, present, type FocusId } from '../presentation';
import { flowToken } from '../../data/focus';
import type { Primitive, Vec3 } from '../parametrik/types';
import { savedSocket, rodOf, position, type BuiltPart } from './installation-parts';
import type { World } from './world';

const base = (id: string) => ({ id, token: '--paper', role: 'neu', material: 'metal' }) as const;
function moduleView(
	world: World,
	p: Extract<BuiltPart, { kind: 'module' }>,
	coarse: boolean
): Primitive[] {
	const support = world.state.parts.get(p.attachedTo);
	const rod = support && rodOf(buildingPlots(world.grid), support);
	const m = rod && savedSocket(rod, p, world.seed);
	if (!m) return [];
	return shellForms(p.id, p.recipe, m, coarse);
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
	return moduleBridge(a, end, p.id, { simplifyAtCity: true }).map((form) => ({
		...form,
		...(form.kind === 'polyline' ? { member: 'secondary' as const, detail: true } : {}),
		token: flowToken.people
	}));
}

function pillarView(world: World, p: Extract<BuiltPart, { kind: 'pillar' }>, a: Vec3): Primitive[] {
	const b = base(p.id);
	const node = p.recipe === 'bearing' ? position(buildingPlots(world.grid), p.anchor) : a;
	const dot: Primitive = {
		...b,
		id: p.id + '/joint',
		cityForm: false,
		member: 'primary',
		bearings: [node],
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

function partView(world: World, p: BuiltPart, coarse: boolean): Primitive[] {
	if (p.kind === 'module') return moduleView(world, p, coarse);
	const a = position(world.grid, p.anchor);
	const b = base(p.id);
	if (p.kind === 'segment') return segmentView(world, p, a);
	if (p.kind === 'pillar') return pillarView(world, p, a);
	const width = p.recipe === 'plaza' ? 2 * WALKWAY_WIDTH_M : WALKWAY_WIDTH_M;
	return [
		{
			...b,
			kind: 'box',
			position: [a[0] - width / 2, a[1] - width / 2, a[2] - 0.25],
			size: [width, width, 0.25],
			token: p.recipe === 'plaza' ? '--cat-business-2' : flowToken.people
		}
	];
}

type CachedPart = {
	start?: World['grid']['cells'][number];
	end?: World['grid']['cells'][number];
	seed: number;
	support?: BuiltPart;
	level: ReturnType<typeof levelFor>;
	coarse: boolean;
	forms: Primitive[];
};
const projections = new WeakMap<BuiltPart, CachedPart>();

/** Projects one immutable installation record at its current support, zoom and drawing level. */
export function installationPartView(world: World, p: BuiltPart, focus: FocusId, coarse = false) {
	// The frame layer projects each solved seam once, including its retained bearings.
	if (p.kind === 'segment' && p.frame) return [];
	const system = world.state.compositions.get(p.owner)?.system ?? 'houses';
	const level = levelFor(focus, system, p.built, world.state.year);
	const support = p.kind === 'module' ? world.state.parts.get(p.attachedTo) : undefined;
	coarse = coarse && p.recipe === 'ceramic';
	const anchors = support ?? p;
	const start = world.grid.cellsById.get(anchors.anchor.cellId);
	const end = anchors.kind === 'segment' ? world.grid.cellsById.get(anchors.end.cellId) : undefined;
	const cached = projections.get(p);
	if (
		cached &&
		cached.start === start &&
		cached.end === end &&
		cached.seed === world.seed &&
		cached.support === support &&
		cached.level === level &&
		cached.coarse === coarse
	)
		return cached.forms;
	const generated = partView(world, p, coarse);
	const parts =
		p.finish === undefined
			? generated
			: generated.map((part) => (part.kind === 'polyline' ? part : { ...part, finish: p.finish }));
	const forms =
		level === 'pencil'
			? parts
					.filter((part) => !part.detail)
					.flatMap((part) =>
						present([part], level).map((styled) => ({
							...styled,
							member: part.member,
							bearings: part.bearings
						}))
					)
			: present(parts, level);
	projections.set(p, { start, end, seed: world.seed, support, level, coarse, forms });
	return forms;
}

/** Projects all installed parts in the selected focus. */
export function installationView(world: World, focus: FocusId, coarse = false) {
	return [...world.state.parts.values()].flatMap((p) =>
		installationPartView(world, p, focus, coarse)
	);
}
