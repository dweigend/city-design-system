import type { BayState } from '../../logic/district-frame';
import { bayAxes, type BaySurvey, type trimBay } from '../../logic/megastructure';
import { frameSurvey, type World } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import type { FocusId } from '../../logic/presentation';
import type { Structures } from './structures';

type Result = ReturnType<typeof trimBay>;
type Display = { bay: BaySurvey; planned: boolean; subdued: boolean; geometry: string };
function forms(row: Display, result?: Result): Primitive[] {
	const { bay, planned, subdued } = row;
	if (result?.status === 'rejected' && !planned) return [];
	const axes = bayAxes(bay).axes;
	const rods =
		result?.status === 'sized' && !planned
			? result.rods
			: axes.map(([a, b], i) => ({ a, b, id: String(i), diameter: 0.18 }));
	// Each installed support runs from its surveyed foot to a chord joint.
	const feet = new Map(
		rods.filter((rod) => rod.id !== '2').map((rod) => [rod.a.join(','), rod.a] as const)
	);
	return rods.map((r): Primitive => ({
		id: bay.id + '/' + r.id,
		kind: 'pipe',
		points: [r.a, r.b],
		radius: r.diameter / 2,
		role: subdued ? 'bestand' : 'traeger',
		member: r.diameter >= 0.18 ? 'primary' : 'secondary',
		sectionDiameter: r.diameter,
		planned,
		cityForm: r.diameter < 0.18 ? false : undefined,
		bearings: r.id === '0' && !planned ? [...feet.values()] : undefined,
		token: planned ? '--blueprint' : '--paper',
		material: 'metal',
		edges: false
	}));
}

/** Projects provisional bays immediately. A single worker sizes current built bays one at a time. */
export function createFrameLayer(
	structures: Pick<Structures, 'set'>,
	render: () => void,
	failure: (detail: string) => void
) {
	let rows = new Map<string, Display>(),
		worker: Worker | undefined,
		active: Display | undefined;
	const cache = new Map<string, Result>();
	let stopped = false;
	let previous:
		{ survey: ReturnType<typeof frameSurvey>; world: World; focus: FocusId } | undefined;
	const roles = new Map<string, { role: string }>();
	const timings = new Map<string, number>();
	const previewTimings = new Map<string, number>();
	const awaitingDraw = new Map<string, number>();
	function submit() {
		if (stopped || active) return;
		const next = [...rows.values()].find(
			(r) => !r.planned && !awaitingDraw.has(r.bay.id) && !cache.has(r.geometry)
		);
		if (!next) return;
		if (!worker) {
			worker = new Worker(new URL('./frame.worker.ts', import.meta.url), { type: 'module' });
			worker.onerror = (e) => {
				stopped = true;
				failure(e.message);
				worker?.terminate();
			};
			worker.onmessage = ({
				data
			}: MessageEvent<{ id: string; result: Result; milliseconds: number }>) => {
				const job = active;
				active = undefined;
				if (!job || stopped) return;
				const current = rows.get(data.id);
				if (current?.geometry === job.geometry) {
					cache.set(job.geometry, data.result);
					timings.set(data.id, data.milliseconds);
					if (data.result.status === 'rejected')
						failure(
							[data.id, data.result.reason, data.result.element, data.result.loadCase].join(' · ')
						);
					structures.set('tg/' + data.id, forms(current, data.result));
					render();
				}
				submit();
			};
		}
		active = next;
		worker.postMessage(next.bay);
	}
	return {
		/** Displays a saved frame generation and exposes still-pending spans as dashed lines. */
		show(world: World, focus: FocusId) {
			const started = performance.now();
			const survey = frameSurvey(world);
			const { bays, seams, rules } = survey;
			const stock = world.state.frameBays ?? new Map();
			const next = new Map(rows);
			const region = changedRegion();
			function changedRegion() {
				if (
					previous &&
					previous.world.seed === world.seed &&
					previous.focus === focus &&
					previous.world.state.year === world.state.year
				) {
					const before = previous.survey;
					const changed = [...new Set([...seams.keys(), ...before.seams.keys()])].filter(
						(id) =>
							JSON.stringify(seams.get(id)) !== JSON.stringify(before.seams.get(id)) ||
							JSON.stringify(bays.get(id)) !== JSON.stringify(before.bays.get(id)) ||
							stock.get(id) !== previous?.world.state.frameBays?.get(id)
					);
					return [
						...new Set([...rules.affected(changed), ...before.rules.affected(changed)])
					].filter((id) => seams.has(id));
				}
				return [...seams.keys()];
			}
			for (const id of next.keys()) if (!seams.has(id)) next.delete(id);
			const redraw = updateRoles();
			function updateRoles() {
				const decisions = rules.solve(region, stock, world.seed);
				const redraw = new Set(region);
				for (const [id, d] of decisions) {
					if (roles.get(id)?.role !== d.role)
						for (const near of rules.affected([id])) redraw.add(near);
					roles.set(id, d);
				}
				for (const id of roles.keys()) if (!seams.has(id)) roles.delete(id);
				return redraw;
			}
			for (const id of redraw) project(id);
			function visibleGeometry(id: string, role: string, installed?: BaySurvey) {
				if (role === 'gap' || world.state.frameInstallations?.get(id)?.result.status === 'rejected')
					return;
				return installed ?? survey.supportedBay(id, roles);
			}
			function project(id: string) {
				const decision = roles.get(id);
				if (!decision) return;
				const old = stock.get(id);
				if (world.state.frameTimeline && !visibleBay(old)) {
					next.delete(id);
					return;
				}
				const installed = installedBay(world, id);
				const bay = visibleGeometry(id, decision.role, installed?.bay);
				if (!bay) {
					next.delete(id);
					return;
				}
				const row = display(bay, old, focus);
				next.set(id, row);
				if (installed) cache.set(row.geometry, installed.result);
				paint(id, row);
			}
			function paint(id: string, row: Display) {
				const prior = rows.get(id);
				if (previous?.world.seed !== world.seed || changed(prior, row)) {
					if (!row.planned && !cache.has(row.geometry)) awaitingDraw.set(id, started);
					structures.set('tg/' + id, forms(row, cache.get(row.geometry)));
				}
			}
			retire();
			function retire() {
				for (const [id, prior] of rows)
					if (next.get(id)?.geometry !== prior.geometry) {
						cache.delete(prior.geometry);
						timings.delete(id);
						if (!next.has(id)) structures.set('tg/' + id, []);
					}
			}
			rows = next;
			previous = { survey, world, focus };
		},
		/** Starts sizing once the preview has been submitted to the renderer. */
		afterDraw() {
			for (const [id, start] of awaitingDraw)
				if (rows.has(id)) previewTimings.set(id, performance.now() - start);
			awaitingDraw.clear();
			submit();
		},
		timings,
		previewTimings,
		dispose() {
			stopped = true;
			worker?.terminate();
			rows.clear();
			cache.clear();
		}
	};
}

function visibleBay(old?: BayState) {
	return old?.pending || old?.built;
}
function installedBay(world: World, id: string) {
	const saved = world.state.frameInstallations?.get(id);
	if (saved?.result.status === 'sized' && world.state.frameBays?.get(id)?.built) return saved;
}
function display(bay: BaySurvey, old: BayState | undefined, focus: FocusId): Display {
	return {
		bay,
		geometry: JSON.stringify(bay),
		planned: !old?.built,
		subdued: !!old?.built && focus !== 'all'
	};
}
function changed(previous: Display | undefined, row: Display) {
	return (
		!previous ||
		previous.geometry !== row.geometry ||
		previous.subdued !== row.subdued ||
		previous.planned !== row.planned
	);
}
