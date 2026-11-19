import { hashUnit } from '../../core/random';
import { seamPolicy, seamProposal, type FrameRole, type FrameSeam } from './seam-policy';

export type BayState = Readonly<{
	built?: Exclude<FrameRole, 'gap'>;
	builtTick?: number;
	pending?: Exclude<FrameRole, 'gap'>;
	ticks?: number;
}>;
export type BaySnapshot = ReadonlyMap<string, BayState>;
export const omissionMeasures = [
	'interior-main',
	'square-interior',
	'enclosure',
	'alley-cover',
	'water-crossing',
	'scarp-bearing',
	'run-length',
	'path-opening',
	'straight-blocks',
	'parallel-distance',
	'block-share',
	'chord-height'
] as const;
type Measure = (typeof omissionMeasures)[number];
export type OmissionEvidence = Partial<Record<Measure, number | string>>;

/** Indexes one survey. Incidence uses stable endpoint and house IDs, including irregular rings. */
export function compileSeams(seams: Iterable<FrameSeam>, policy = seamPolicy()) {
	const byId = new Map<string, FrameSeam>();
	const vertices = new Map<string, FrameSeam[]>(),
		houses = new Map<string, FrameSeam[]>();
	function add(index: Map<string, FrameSeam[]>, id: string, seam: FrameSeam) {
		const list = index.get(id) ?? [];
		list.push(seam);
		index.set(id, list);
	}
	for (const s of seams) {
		if (byId.has(s.id)) throw new RangeError('Duplicate seam: ' + s.id);
		byId.set(s.id, s);
		for (const v of s.vertices) add(vertices, v, s);
		for (const h of s.houses) add(houses, h, s);
	}
	const adjacent = (s: FrameSeam) =>
		s.vertices.flatMap((v) => vertices.get(v) ?? []).filter((n) => n.id !== s.id);
	function solve(ids: Iterable<string>, state: BaySnapshot, seed: number) {
		const result = new Map<string, ReturnType<typeof seamProposal>>();
		const proposals = new Map<string,ReturnType<typeof seamProposal>>();
		function raw(s:FrameSeam) {
			const value=proposals.get(s.id) ?? seamProposal(s,seed,policy);
			proposals.set(s.id,value);
			return value;
		}
		const priority = (s: FrameSeam) => hashUnit(seed, s.id, 'tg-seat-v1');
		const compare = (a: FrameSeam, b: FrameSeam) =>
			Number(state.get(b.id)?.built === 'main') - Number(state.get(a.id)?.built === 'main') ||
			Number(b.intent === 'main') - Number(a.intent === 'main') ||
			priority(a) - priority(b) ||
			(a.id < b.id ? -1 : Number(a.id !== b.id));
		function eligible(s: FrameSeam) {
			if (state.get(s.id)?.built === 'main') return true;
			if (raw(s).role !== 'main') return false;
			if (s.gate && adjacent(s).some((n) => n.gate && (state.get(n.id)?.built==='main' || (raw(n).role === 'main' && compare(n, s) < 0))))
				return false;
			return s.houses.every(
				(h) =>
					(houses.get(h) ?? []).filter(
						(n) =>
							(state.get(n.id)?.built === 'main' || raw(n).role === 'main') && compare(n, s) < 0
					).length < policy.maxFramedSides
			);
		}
		function connected(s: FrameSeam) {
			const ring = adjacent(s);
			const isRoot = (n: FrameSeam) => state.get(n.id)?.built === 'main';
			return (
				(policy.maxBranchSeams >= 1 && ring.some(isRoot)) ||
				(policy.maxBranchSeams >= 2 &&
					ring.some((n) => state.get(n.id)?.built === 'secondary' && adjacent(n).some(isRoot)))
			);
		}
		for (const id of [...new Set(ids)].sort()) {
			const s = byId.get(id);
			if (!s) throw new RangeError('Unknown seam: ' + id);
			let proposal = raw(s);
			if (!s.attachment && proposal.role==='gap' && s.vertices.every(v=>
				(vertices.get(v)??[]).some(n=>n.id!==s.id && state.get(n.id)?.built==='main'))) {
				const connector=seamProposal({...s,attachment:true},seed,policy);
				if(connector.role==='secondary') proposal=connector;
			}
			if (proposal.role === 'main' && (!eligible(s) || !adjacent(s).some(eligible)))
				proposal = { role: 'gap', reason: 'unsupported-or-enclosed' };
			if (proposal.role === 'secondary' && !connected(s))
				proposal = { role: 'gap', reason: 'detached-spur' };
			const built = state.get(id)?.built;
			if (built && (built === 'main' || proposal.role === 'gap'))
				proposal = { role: built, reason: s.intent && proposal.role !== s.intent ? proposal.reason : s.intent && s.intent !== built ? 'protected-stock' : 'built' };
			result.set(id, proposal);
		}
		return result;
	}
	return {
		/** Returns the two incident rings affected by an edit. Union both surveys on a topology change. */
		affected(ids: Iterable<string>) {
			const found = new Set(ids);
			let frontier = [...found];
			for (let ring = 0; ring < 2; ring++) {
				const next = new Set<string>();
				for (const id of frontier) {
					const seam = byId.get(id);
					if (!seam) continue;
					const near = [...adjacent(seam), ...seam.houses.flatMap((h) => houses.get(h) ?? [])];
					for (const n of near)
						if (!found.has(n.id)) {
							found.add(n.id);
							next.add(n.id);
						}
				}
				frontier = [...next];
			}
			return [...found].sort();
		},
		solve,
		/** Attaches read-only measurements. Missing survey evidence stays unknown and never affects selection. */
		explain(id: string, state: BaySnapshot, seed: number, evidence: OmissionEvidence = {}) {
			const [decision] = solve([id], state, seed).values();
			return {
				...decision,
				ruleId: decision.reason,
 blocker: byId.get(id)?.blocker ?? id,
				diagnostics: omissionMeasures.map((measure) => ({
					measure,
					value: evidence[measure] ?? null
				}))
			};
		},
		/** Returns a synchronous sparse patch; preserves every previously built bay and its stock. */
		tick(ids: Iterable<string>, state: BaySnapshot, seed: number, tick: number) {
			const patch = new Map<string, BayState>();
			for (const [id, { role }] of solve(ids, state, seed)) {
				const old = state.get(id);
				if (role === 'gap' || role === old?.built) {
					if (old?.pending) patch.set(id, { built: old.built, builtTick: old.builtTick });
					continue;
				}
				const ticks = (old?.pending === role ? (old.ticks ?? 0) : 0) + 1;
				patch.set(
					id,
					ticks >= policy.frameDelayTicks
						? { built: role, builtTick: tick }
						: { ...old, pending: role, ticks }
				);
			}
			return patch;
		}
	};
}
