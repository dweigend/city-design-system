import { tickPatch } from '../../core/neighbourhood';
import { hashUnit } from '../../core/random';
import { seamPolicy, seamProposal, type FrameRole, type FrameSeam } from './seam-policy';

export type BayState = Readonly<{
	built?: Exclude<FrameRole, 'gap'>;
	builtTick?: number;
	builtYear?: number;
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

type Proposal = ReturnType<typeof seamProposal>;

function protect(seam: FrameSeam, built: BayState['built'], proposal: Proposal): Proposal {
	if (!built || (built !== 'main' && proposal.role !== 'gap')) return proposal;
	if (seam.intent && proposal.role !== seam.intent) return { ...proposal, role: built };
	const reason = seam.intent && seam.intent !== built ? 'protected-stock' : 'built';
	return { ...proposal, role: built, reason };
}

function elapsed(old: BayState | undefined, role: FrameRole) {
	return (old?.pending === role ? (old.ticks ?? 0) : 0) + 1;
}

function advanceBay(
	old: BayState | undefined,
	role: FrameRole,
	delay: number,
	tick: number,
	year?: number
): BayState | undefined {
	if (role === 'gap' || role === old?.built) {
		if (!old?.pending) return;
		const stock = { ...old };
		delete stock.pending;
		delete stock.ticks;
		return stock;
	}
	const ticks = elapsed(old, role);
	if (ticks < delay) return { ...old, pending: role, ticks };
	return { built: role, builtTick: tick, ...(year === undefined ? {} : { builtYear: year }) };
}

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
	function evaluate(state: BaySnapshot, seed: number) {
		const proposals = new Map<string, ReturnType<typeof seamProposal>>();
		function raw(s: FrameSeam) {
			const value = proposals.get(s.id) ?? seamProposal(s, seed, policy);
			proposals.set(s.id, value);
			return value;
		}
		const priority = (s: FrameSeam) => hashUnit(seed, s.id, 'tg-seat-v1');
		const compare = (a: FrameSeam, b: FrameSeam) =>
			Number(state.get(b.id)?.built === 'main') - Number(state.get(a.id)?.built === 'main') ||
			Number(b.intent === 'main') - Number(a.intent === 'main') ||
			priority(a) - priority(b) ||
			(a.id < b.id ? -1 : Number(a.id !== b.id));
		function capacity(s: FrameSeam) {
			const outranks = (n: FrameSeam) =>
				(state.get(n.id)?.built === 'main' || raw(n).role === 'main') && compare(n, s) < 0;
			if (s.gate) {
				const other = adjacent(s)
					.filter((n) => n.gate && outranks(n))
					.sort(compare)[0];
				if (other) return { reason: 'adjacent-gate', blocker: other.id };
			}
			for (const h of s.houses) {
				const occupied = (houses.get(h) ?? []).filter(outranks).sort(compare);
				if (occupied.length >= policy.maxFramedSides)
					return { reason: 'house-capacity', blocker: occupied[0].id };
			}
		}
		function eligible(s: FrameSeam) {
			return state.get(s.id)?.built === 'main' || (raw(s).role === 'main' && !capacity(s));
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
		function connector(s: FrameSeam, proposal: Proposal) {
			if (
				!s.attachment &&
				proposal.role === 'gap' &&
				s.vertices.every((v) =>
					(vertices.get(v) ?? []).some((n) => n.id !== s.id && state.get(n.id)?.built === 'main')
				)
			) {
				const connector = seamProposal({ ...s, attachment: true }, seed, policy);
				if (connector.role === 'secondary') proposal = connector;
			}
			return proposal;
		}
		function decide(s: FrameSeam) {
			let proposal = raw(s);
			proposal = connector(s, proposal);
			if (proposal.role === 'main' && !(eligible(s) && adjacent(s).some(eligible)))
				proposal = {
					role: 'gap',
					...(capacity(s) ?? { reason: 'isolated-main', blocker: s.id })
				};
			if (proposal.role === 'secondary' && !connected(s))
				proposal = { role: 'gap', reason: 'detached-spur' };
			return protect(s, state.get(s.id)?.built, proposal);
		}
		return { decide, eligible };
	}
	function requested(ids: Iterable<string>) {
		return [...new Set(ids)].sort().map((id) => {
			const seam = byId.get(id);
			if (!seam) throw new RangeError('Unknown seam: ' + id);
			return seam;
		});
	}
	function solve(ids: Iterable<string>, state: BaySnapshot, seed: number) {
		const { decide } = evaluate(state, seed);
		return new Map(requested(ids).map((s) => [s.id, decide(s)]));
	}
	function tick(
		ids: Iterable<string>,
		state: BaySnapshot,
		seed: number,
		tick: number,
		year?: number,
		admit: (id: string) => boolean = () => true,
		rejected = new Set<string>()
	) {
		const { decide, eligible } = evaluate(state, seed);
		const patch = tickPatch<BayState>();
		function partner(s: FrameSeam) {
			if (state.get(s.id)?.built === 'main') return true;
			return (
				eligible(s) && elapsed(state.get(s.id), 'main') >= policy.frameDelayTicks && admit(s.id)
			);
		}
		for (const s of requested(ids)) {
			const old = state.get(s.id),
				{ role } = decide(s);
			const next = advanceBay(old, role, policy.frameDelayTicks, tick, year);
			if (!next) continue;
			const building = next.built && next.built !== old?.built;
			if (building && (!admit(s.id) || (role === 'main' && !adjacent(s).some(partner))))
				rejected.add(s.id);
			else patch.set(s.id, next);
		}
		return patch;
	}
	return {
		/** Returns two rings for main arbitration and dependent two-hop spurs. Union both surveys on a topology change. */
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
				blocker: decision.blocker ?? byId.get(id)?.blocker ?? id,
				diagnostics: omissionMeasures.map((measure) => ({
					measure,
					value: evidence[measure] ?? null
				}))
			};
		},
		/** Advances only requested addresses against the same frozen incidence and stock. */
		tick
	};
}
