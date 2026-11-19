import { bayAxes, type BaySurvey, type trimBay } from '../../logic/megastructure';
import { frameSurvey, type World } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import type { FocusId } from '../../logic/presentation';
import type { Structures } from './structures';

type Result = ReturnType<typeof trimBay>;
type Display = { bay: BaySurvey; planned: boolean; aged: boolean; geometry: string };
function forms(row: Display, result?: Result): Primitive[] {
	const { bay, planned, aged } = row;
	if (result?.status === 'rejected' && !planned) return [];
	const axes = bayAxes(bay).axes;
	const rods =
		result?.status === 'sized' && !planned
			? result.rods
			: axes.map(([a, b], i) => ({ a, b, id: String(i), diameter: 0.18 }));
	return rods.map((r): Primitive => ({
		id: bay.id + '/' + r.id,
		kind: 'pipe',
		points: [r.a, r.b],
		radius: r.diameter / 2,
		role: aged ? 'bestand' : 'traeger',
		member: r.diameter >= 0.18 ? 'primary' : 'secondary',
		sectionDiameter: r.diameter,
		planned,
		cityForm: r.diameter < 0.18 ? false : undefined,
		bearings: r.id === '0' && !planned ? [bay.a, bay.b, bay.back] : undefined,
		token: planned ? '--blueprint' : '--paper',
		material: 'metal',
		edges: false
	}));
}

/** Projects provisional bays immediately. A single worker sizes current built bays one at a time. */
export function createFrameLayer(
	structures: Structures,
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
	const timings = new Map<string,number>();
	const previewTimings=new Map<string,number>();
	const awaitingDraw=new Map<string,number>();
	function submit() {
		if (stopped || active) return;
		const next = [...rows.values()].find((r) => !r.planned && !awaitingDraw.has(r.bay.id) && !cache.has(r.geometry));
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
			const started=performance.now();
			const survey = frameSurvey(world);
			const { bays, seams, rules } = survey;
			const stock = world.state.frameBays ?? new Map();
			const next = new Map(rows);
			let region = [...seams.keys()];
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
				region = [
					...new Set([...rules.affected(changed), ...before.rules.affected(changed)])
				].filter((id) => seams.has(id));
			}
			for (const id of next.keys()) if (!seams.has(id)) next.delete(id);
			const decisions = rules.solve(region, stock, world.seed);
			const redraw = new Set(region);
			for (const [id, d] of decisions) {
				if (roles.get(id)?.role !== d.role)
					for (const near of rules.affected([id])) redraw.add(near);
				roles.set(id, d);
			}
			for (const id of roles.keys()) if (!seams.has(id)) roles.delete(id);
			for (const id of redraw) {
				const decision = roles.get(id);
				const bay = survey.supportedBay(id, roles);
				if (!decision) continue;
				if (!bay || decision.role === 'gap') {
					next.delete(id);
					continue;
				}
				const old = stock.get(id);
				const row = {
					bay,
					geometry: JSON.stringify(bay),
					planned: !old?.built,
					aged:
						!!old?.built &&
						((old.builtTick ?? world.state.year) < world.state.year || focus !== 'all')
				};
				next.set(id, row);
				const prior = rows.get(id);
				if (
					previous?.world.seed !== world.seed || prior?.geometry !== row.geometry ||
					prior.planned !== row.planned ||
					prior.aged !== row.aged
				) {
					if(!row.planned && !cache.has(row.geometry)) awaitingDraw.set(id,started);
					structures.set('tg/' + id, forms(row, cache.get(row.geometry)));
				}
			}
			for (const [id, prior] of rows)
				if (next.get(id)?.geometry !== prior.geometry) {
					cache.delete(prior.geometry);
					timings.delete(id);
					if (!next.has(id)) structures.set('tg/' + id, []);
				}
			rows = next;
			previous = { survey, world, focus };
		},
		/** Starts sizing once the preview has been submitted to the renderer. */
		afterDraw() {
			for (const [id,start] of awaitingDraw) if(rows.has(id)) previewTimings.set(id,performance.now()-start);
			awaitingDraw.clear();
			submit();
		},
		timings,previewTimings,
		dispose() {
			stopped = true;
			worker?.terminate();
			rows.clear();
			cache.clear();
		}
	};
}
