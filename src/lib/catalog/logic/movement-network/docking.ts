import { treadCount } from '../walkway';
import type { DockRequest, MovementElement, MovementPort } from './types';

type Adapter = 'stair' | 'ramp';
type Parts = { ports: MovementPort[]; edges: MovementElement[] };
const empty = (): Parts => ({ ports: [], edges: [] });
// Survey tolerance in metres. Headings are compared by their unit-vector dot product.
const epsilon = 1e-7;
const aligned = (a: number, b: number) => Math.cos(a - b) >= 1 - 1e-7;

function directKind(mode: DockRequest['mode'], run: number) {
	if (run <= epsilon) return 'dock';
	return mode === 'rail' ? 'monorail' : 'path';
}
function connectionKind(
	request: DockRequest,
	a: MovementPort,
	b: MovementPort,
	run: number,
	rise: number
) {
	const level = rise <= request.profile.rampGrade * run + epsilon;
	if (level && a.accepts.includes(b.kind) && b.accepts.includes(a.kind))
		return directKind(request.mode, run);
	return walkingAdapter(request, [a, b], run, rise, level ? 'ramp' : 'stair');
}

function walkingAdapter(
	r: DockRequest,
	ports: MovementPort[],
	run: number,
	rise: number,
	kind: Adapter
) {
	if (r.mode === 'rail' || run <= epsilon || rise < epsilon) return;
	if (kind === 'stair' && !fitsTreads(r.profile, rise, run)) return;
	if (rise <= r.profile.stairGrade * run + epsilon && ports.every((p) => p.accepts.includes(kind)))
		return kind;
}

function fitsTreads({ treadGoing, stairGrade }: DockRequest['profile'], rise: number, run: number) {
	return !treadGoing || treadCount(rise, stairGrade * treadGoing) * treadGoing <= run + epsilon;
}
function adapterPort(id: string, kind: Adapter, partner: MovementPort): MovementPort {
	return { ...partner, id, kind, heading: partner.heading + Math.PI, accepts: [partner.kind] };
}
function build(
	r: DockRequest,
	a: MovementPort,
	b: MovementPort,
	kind: MovementElement['kind']
): Parts {
	const edge = (
		id: string,
		from: MovementPort,
		to: MovementPort,
		kind: MovementElement['kind']
	): MovementElement => ({
		id,
		from: from.id,
		to: to.id,
		kind,
		mode: r.mode ?? 'walk',
		width: r.profile.width,
		capacity: r.profile.capacity
	});
	if (kind !== 'stair' && kind !== 'ramp') return { ports: [], edges: [edge(r.id, a, b, kind)] };
	const start = adapterPort(r.id + '/from', kind, a),
		end = adapterPort(r.id + '/to', kind, b);
	return {
		ports: [start, end],
		edges: [
			edge(r.id + '/entry', a, start, 'dock'),
			edge(r.id, start, end, kind),
			edge(r.id + '/exit', end, b, 'dock')
		]
	};
}

function admits(r: DockRequest, p: MovementPort) {
	if (p.width < r.profile.width || p.headroom < r.profile.headroom) return false;
	return r.mode === 'rail'
		? ['monorail', 'station', 'bridge', 'tunnel'].includes(p.kind)
		: p.kind !== 'monorail';
}

/** Fits a straight connection between surveyed mouths. An unsuitable request yields no parts. */
export function dock(request: DockRequest, a: MovementPort, b: MovementPort): Parts {
	const { profile } = request;
	if (
		!Object.values(profile).every((v) => Number.isFinite(v) && v > 0) ||
		profile.rampGrade > profile.stairGrade
	)
		throw new RangeError('Invalid docking profile');
	if (a.id === b.id || !admits(request, a) || !admits(request, b)) return empty();
	const dx = b.position[0] - a.position[0],
		dy = b.position[1] - a.position[1];
	const run = Math.hypot(dx, dy),
		rise = Math.abs(b.position[2] - a.position[2]);
	const angle = run <= epsilon ? a.heading : Math.atan2(dy, dx);
	if (!aligned(a.heading, angle) || !aligned(b.heading, angle + Math.PI)) return empty();
	const kind = connectionKind(request, a, b, run, rise);
	return kind ? build(request, a, b, kind) : empty();
}
