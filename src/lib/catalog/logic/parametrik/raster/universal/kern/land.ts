import { encode, decode } from './serialization';
import { parcelize, type ParcelOptions, type Front } from './parcels';
import { transact, type Edit, type Transaction } from './transactions';
import { InvariantError, type Model } from './types';
export type ParcelPlan = {
	block: string;
	fronts: readonly (Omit<Front, 'a' | 'b'> & { a: string; b: string })[];
	options: ParcelOptions;
};
export type LandState = {
	model: Model;
	plans: ReadonlyMap<string, ParcelPlan>;
	parcels: ReadonlyMap<string, ReturnType<typeof parcelize>>;
	frontDependencies: ReadonlyMap<string, readonly string[]>;
};
function derive(model: Model, plan: ParcelPlan) {
	const f = model.intent.faces.get(plan.block);
	if (!f || plan.options.level !== f.level)
		throw new InvariantError('invalid-parcel-block', [plan.block]);
	const fronts = plan.fronts.map((front) => {
		const a = model.intent.positions.get(front.a),
			b = model.intent.positions.get(front.b);
		if (!a || !b) throw new InvariantError('unknown-front-vertex', [front.id]);
		return { ...front, a, b };
	});
	return parcelize(
		plan.block,
		f.ring.map((id) => model.intent.positions.get(id)!),
		fronts,
		plan.options
	);
}
export function compileLand(model: Model, plans: ReadonlyMap<string, ParcelPlan>): LandState {
	const parcels = new Map<string, ReturnType<typeof parcelize>>(),
		frontDependencies = new Map<string, string[]>();
	for (const [id, p] of plans) {
		if (id !== p.block) throw new InvariantError('parcel-plan-id', [id]);
		parcels.set(id, derive(model, p));
		for (const f of p.fronts)
			for (const v of [f.a, f.b]) {
				if (!frontDependencies.has(v)) frontDependencies.set(v, []);
				if (!frontDependencies.get(v)!.includes(id)) frontDependencies.get(v)!.push(id);
			}
	}
	return { model, plans: structuredClone(plans), parcels, frontDependencies };
}
export type LandTransaction = {
	before: LandState;
	after: LandState;
	model: Transaction;
	dirtyParcels: readonly string[];
};
/** Dependency closure includes external frontage endpoints, not a fixed geometric radius. */
export function transactLand(before: LandState, edit: Edit): LandTransaction {
	const tx = transact(before.model, edit),
		dirty = new Set(tx.dirty.filter((id) => before.plans.has(id)));
	for (const id of edit.positions?.keys() ?? [])
		for (const p of before.frontDependencies.get(id) ?? []) dirty.add(p);
	const parcels = new Map(before.parcels);
	for (const id of [...dirty].sort()) parcels.set(id, derive(tx.after, before.plans.get(id)!));
	return {
		before,
		after: { ...before, model: tx.after, parcels },
		model: tx,
		dirtyParcels: [...dirty].sort()
	};
}
export function undoLand(current: LandState, tx: LandTransaction) {
	if (current !== tx.after) throw new InvariantError('stale-undo');
	return tx.before;
}
export function redoLand(current: LandState, tx: LandTransaction) {
	if (current !== tx.before) throw new InvariantError('stale-redo');
	return tx.after;
}

export function encodeLand(state: LandState): string {
	return JSON.stringify({
		version: 1,
		model: JSON.parse(encode(state.model)),
		plans: [...state.plans].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	});
}
export function decodeLand(json: string): LandState {
	const data = JSON.parse(json);
	if (
		data.version !== 1 ||
		!Array.isArray(data.plans) ||
		new Map(data.plans).size !== data.plans.length
	)
		throw new InvariantError('invalid-land-format');
	return compileLand(decode(JSON.stringify(data.model)), new Map(data.plans));
}
