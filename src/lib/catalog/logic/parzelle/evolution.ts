import {
	byId,
	canonical,
	failure,
	isPublic,
	PRIVATE_USES,
	type DriverSpec,
	type ErrorCode,
	type Outcome,
	type ParcelRules,
	type ParcelState,
	type Point
} from './typen';
import { obb, points } from './geometrie';
import { accessOf, neighbors, parcelArea } from './zugang';
import { convertParcel, mergeParcels, splitParcel } from './operationen';
import { CHANNEL, hashUnit } from './zufall';
/** Continues epochs deterministically; new result or error, 0 returns input identity; m/m², no mutation. */
export function evolve(
	input: ParcelState,
	rules: ParcelRules,
	drivers: DriverSpec,
	epochCount: number
): Outcome<ParcelState> {
	if (epochCount === 0) return { ok: true, value: input };
	// Invalid drivers/budgets have no error code of their own: size-rule, no partial application.
	if (
		!Number.isInteger(epochCount) ||
		epochCount < 0 ||
		Object.values(drivers).some((v) => !Number.isFinite(v) || v < 0) ||
		drivers.split + drivers.merge + drivers.convert > 1
	)
		return failure('size-rule', 'Invalid drivers/epoch count');
	let s = canonical(input);
	for (let e = input.epoch + 1; e <= input.epoch + epochCount; e++) {
		s.epoch = e;
		const start = s,
			access = accessOf(start);
		const proposals: {
			id: string;
			kind: 'split' | 'merge' | 'convert';
			ids: string[];
			priority: number;
		}[] = [];
		for (const p of start.parcels) {
			if (p.isProtected || isPublic(p.use)) continue;
			const u = hashUnit(s.seed, e, p.id, CHANNEL.event),
				priority = hashUnit(s.seed, e, p.id, CHANNEL.priority);
			if (u < drivers.split) {
				if (
					parcelArea(s, p.id) >= 2 * rules.areaMin &&
					(access.get(p.id)?.front ?? 0) >= 2 * rules.frontMin
				)
					proposals.push({ id: p.id, kind: 'split', ids: [p.id], priority });
			} else if (u < drivers.split + drivers.merge) {
				const ns = neighbors(s, p.id)
					.filter((n) => {
						const q = s.parcels.find((q) => q.id === n.id);
						return q && !q.isProtected && !isPublic(q.use);
					})
					.sort((a, b) => parcelArea(s, a.id) - parcelArea(s, b.id) || byId(a, b));
				if (ns[0])
					proposals.push({ id: p.id, kind: 'merge', ids: [p.id, ns[0].id].sort(), priority });
			} else if (u < drivers.split + drivers.merge + drivers.convert)
				proposals.push({ id: p.id, kind: 'convert', ids: [p.id], priority });
		}
		const touched = new Set<string>();
		for (const proposal of proposals.sort((a, b) => a.priority - b.priority || byId(a, b))) {
			// Footprint: the parcels involved and their private neighbors. Public parcels never change
			// substantively in evolve (at most collinear vertices) and therefore do not block; otherwise the
			// courtyard that every edge parcel borders would lock the whole epoch after the first event.
			// Converting changes no geometry and touches only itself.
			const isPrivateAtStart = (id: string) => {
				const q = start.parcels.find((p) => p.id === id);
				return !!q && !isPublic(q.use);
			};
			const footprint = new Set(
				proposal.kind === 'convert'
					? proposal.ids
					: proposal.ids.flatMap((id) => [
							id,
							...neighbors(start, id)
								.map((n) => n.id)
								.filter(isPrivateAtStart)
						])
			);
			if ([...footprint].some((id) => touched.has(id))) continue;
			let result: Outcome<ParcelState>,
				resultIds = proposal.ids,
				code: ErrorCode = 'size-rule';
			const accessible = (
				candidate: ParcelState,
				ids: string[],
				size: boolean
			): ErrorCode | undefined => {
				const a = accessOf(candidate);
				if (ids.some((id) => !a.get(id)?.levels.length)) return 'no-access';
				if (
					size &&
					ids.some(
						(id) =>
							parcelArea(candidate, id) < rules.areaMin || (a.get(id)?.front ?? 0) < rules.frontMin
					)
				)
					return 'size-rule';
			};
			if (proposal.kind === 'split') {
				const p = s.parcels.find((p) => p.id === proposal.id);
				if (!p) continue;
				const box = obb(points(s, p)),
					offset =
						box.long * rules.irregularity * (hashUnit(s.seed, e, p.id, CHANNEL.split) - 0.5) * 0.5;
				const point: Point = [
					box.center[0] + box.axis[0] * offset,
					box.center[1] + box.axis[1] * offset
				];
				result = failure('size-rule');
				resultIds = [`${p.id}.0`, `${p.id}.1`];
				for (const line of [
					{ point, direction: [-box.axis[1], box.axis[0]] as Point },
					{ point: box.center, direction: box.axis }
				]) {
					const attempt = splitParcel(s, p.id, line);
					if (!attempt.ok) {
						code = attempt.code;
						continue;
					}
					const error = accessible(attempt.value, resultIds, true);
					if (error) {
						code = error;
						continue;
					}
					result = attempt;
					break;
				}
				if (!result.ok) result = failure(code);
			} else if (proposal.kind === 'merge') {
				result = mergeParcels(s, proposal.ids[0], proposal.ids[1]);
				resultIds = [proposal.ids[0]];
				if (result.ok) {
					const error = accessible(result.value, resultIds, false);
					if (error) result = failure(error);
				}
			} else {
				const p = s.parcels.find((p) => p.id === proposal.id);
				if (!p) continue;
				const uses = PRIVATE_USES.filter((use) => use !== p.use),
					use = uses[Math.floor(hashUnit(s.seed, e, p.id, CHANNEL.target) * uses.length)];
				result = convertParcel(s, p.id, use);
				if (result.ok) {
					const error = accessible(result.value, resultIds, false);
					if (error) result = failure(error);
				}
			}
			if (result.ok) {
				s = result.value;
				for (const id of footprint) touched.add(id);
				s.log.push({ epoch: e, kind: proposal.kind, parcelIds: proposal.ids, resultIds });
			} else {
				s = canonical(s);
				s.log.push({
					epoch: e,
					kind: 'reject',
					parcelIds: proposal.ids,
					resultIds: [],
					code: result.code
				});
			}
		}
		s = canonical(s);
		s.epoch = e;
	}
	return { ok: true, value: s };
}
