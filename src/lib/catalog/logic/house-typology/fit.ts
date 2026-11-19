import { profile, penetration } from './fit-geometry';
import type { FitPart, Joint } from './types';
import { invalidScale } from './rigid';
import { circleDepth, discDepth } from './circle';
const tolerance = 0.02 + 1e-9;
export type Finding = {
	code:
		| 'floating'
		| 'intersects'
		| 'post-end'
		| 'missing-socket'
		| 'rigid-scale'
		| 'invalid'
		| 'uncertain-contact';
	part: string;
	other?: string;
};
const socketObjects = new Set<string | undefined>(['capsule-cradle', 'capsule-socket']);
function cylinderJoint(p: Pick<FitPart, 'role' | 'id'>) {
	return p.role === 'traeger' || p.id.includes('/post/') ? 'shaft' : undefined;
}
function joint(p: FitPart): Joint | undefined {
	if (p.joint) return p.joint;
	if (socketObjects.has(p.source?.objectId)) return 'socket';
	if (p.kind === 'capsule') return 'capsule';
	if (p.kind === 'cylinder') return cylinderJoint(p);
	if (p.kind === 'prism' && p.bearing === 'slab') return 'deck';
	return undefined;
}

function describe(p: FitPart) {
	const shape = profile(p);
	return {
		p,
		...shape,
		joint: joint(p),
		bearers: new Set<FitPart>(),
		below: new Set<Joint | undefined>(),
		above: new Set<Joint | undefined>()
	};
}
type Entry = ReturnType<typeof describe>;
function bearing(lower: Entry, upper: Entry) {
	if (Math.abs(lower.bounds.max[2] - upper.bounds.min[2]) > tolerance) return;
	const a = lower.faces ?? [lower.top],
		b = upper.faces ?? [upper.bottom];
	if (!a.some((f) => f.length && b.some((g) => g.length && penetration(f, g) >= -1e-9))) return;
	lower.above.add(upper.joint);
	upper.below.add(lower.joint);
	upper.bearers.add(lower.p);
}
function disc(p: FitPart) {
	return p.kind === 'cylinder' || p.kind === 'dome' || p.kind === 'sphere' ? p : undefined;
}
type Disc = ReturnType<typeof disc>;
type Faces = Entry['faces'];
function separatedDiscs(ac: Disc, bc: Disc, af: Faces, bf: Faces) {
	if (ac && bc && circleDepth(ac, bc) <= tolerance) return true;
	if (ac && bf && bf.every((f) => discDepth(ac, f) <= tolerance)) return true;
	if (bc && af && af.every((f) => discDepth(bc, f) <= tolerance)) return true;
	return false;
}
function contact(a: Entry, b: Entry): Finding['code'] | undefined {
	const af = a.faces ?? (a.polygon ? [a.polygon] : undefined),
		bf = b.faces ?? (b.polygon ? [b.polygon] : undefined);
	const ac = disc(a.p),
		bc = disc(b.p);
	if (separatedDiscs(ac, bc, af, bf)) return;
	if (af && bf && !af.some((f) => bf.some((g) => penetration(f, g) > tolerance))) return undefined;
	return (ac || af) && (bc || bf) ? 'intersects' : 'uncertain-contact';
}
function inspectPair(a: Entry, b: Entry, findings: Finding[]) {
	const overlap = a.bounds.max.map((v, i) =>
		Math.min(v - b.bounds.min[i], b.bounds.max[i] - a.bounds.min[i])
	);
	if (overlap[0] < 0 || overlap[1] < 0 || overlap[2] < -tolerance) return;
	bearing(a, b);
	bearing(b, a);
	if (Math.min(...overlap) <= tolerance) return;
	const code = contact(a, b);
	if (code) findings.push({ code, part: a.p.id, other: b.p.id });
}
/** Tests two world-space parts at the same two-centimetre tolerance as the assembly audit. */
export function partsIntersect(a: FitPart, b: FitPart) {
	const findings: Finding[] = [];
	inspectPair(describe(a), describe(b), findings);
	return findings.length > 0;
}
const postEnds: Partial<Record<Joint, Joint[]>> = {
	head: ['deck', 'beam'],
	shaft: ['head', 'deck', 'beam']
};
function missingPostEnd({ joint, above }: Entry) {
	const ends = joint && postEnds[joint];
	return ends && !ends.some((end) => above.has(end));
}
function inspectJoint(e: Entry, grounded: Set<FitPart>, findings: Finding[]) {
	const { p, joint: j, below } = e;
	if (!grounded.has(p)) findings.push({ code: 'floating', part: p.id });
	if (j === 'capsule' && !below.has('socket'))
		findings.push({ code: 'missing-socket', part: p.id });
	if (missingPostEnd(e)) findings.push({ code: 'post-end', part: p.id });
	if (invalidScale(p)) findings.push({ code: 'rigid-scale', part: p.id });
}
/** Audits world-space assembly solids, or registry primitives with optional joint/transform metadata.
 * Ground defaults to z=0. Unsupported non-convex contacts produce a finding when their envelopes conflict. */
export function checkFit(parts: readonly FitPart[]): Finding[] {
	const findings: Finding[] = [],
		entries = parts.filter((p) => p.kind !== 'polyline').map(describe);
	for (const [i, a] of entries.entries()) {
		if (
			a.bounds.min.some(
				(n, j) =>
					!Number.isFinite(n) || !(a.bounds.max[j] >= n) || !Number.isFinite(a.bounds.max[j])
			)
		)
			findings.push({ code: 'invalid', part: a.p.id });
		for (let j = 0; j < i; j++) inspectPair(entries[j], a, findings);
	}
	const anchored = new Set(
		entries
			.filter((e) => Math.abs(e.bounds.min[2] - (e.p.ground ?? 0)) <= tolerance)
			.map((e) => e.p)
	);
	let before;
	do {
		before = anchored.size;
		for (const e of entries) if ([...e.bearers].some((p) => anchored.has(p))) anchored.add(e.p);
	} while (anchored.size !== before);
	for (const e of entries) inspectJoint(e, anchored, findings);
	return findings;
}
