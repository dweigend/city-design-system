import { expect, test } from 'bun:test';
import { createBuildQueue } from '../../lib/scene/sandbox-interaction';
import type { Drawable } from '../../lib/scene/surface';
import {
	collectPlacedDrawables,
	createTownSandbox,
	submitPlacementRequests,
	type Detail,
	type PlacementRequest
} from './town';

function findUnbuildableHouseParcel(town: ReturnType<typeof createTownSandbox>) {
	for (const parcel of town.world.holdings.parcels) {
		if (parcel.publicUse) continue;
		const document = town.world.createDocument();
		const host = { kind: 'parcel', id: parcel.id } as const;
		document.apply([
			town.world.place('house/court-neutral', host, town.readBrushParams('house/court-neutral'))
		]);
		const placement = document.readPlacement(host);
		if (placement && town.world.resolveHouse(placement)?.status === 'unbuildable') return parcel;
	}
	throw new Error('Expected at least one unbuildable house parcel in the town sandbox');
}

test.each(['waiting', 'built'] as const)(
	'replacing a %s grove with an unbuildable house cancels the grove job and clears its drawables',
	(phase) => {
		const town = createTownSandbox();
		const parcel = findUnbuildableHouseParcel(town);
		const host = { kind: 'parcel', id: parcel.id } as const;
		const document = town.world.createDocument();
		const cache = town.createCache(document);
		let clock = 0;
		const queue = createBuildQueue<readonly Drawable[]>(() => clock);
		const serials = new WeakMap<PlacementRequest, number>();
		const bodies = new WeakMap<PlacementRequest, Drawable>();
		let serial = 0;

		const detailsOf = (requests: ReadonlyMap<string, PlacementRequest>) =>
			new Map<string, Detail>(
				[...requests.keys()].map((id) => [id, { level: 'plain', budget: 1 }])
			);

		document.apply([town.world.place('park/grove', host, {})]);
		const grove = document.readPlacement(host);
		expect(grove).toBeDefined();
		if (!grove) return;

		const before = new Map(cache.read().map((request) => [request.placement.id, request]));
		submitPlacementRequests(queue, before, detailsOf(before), serials, () => serial++);
		expect(queue.readWaiting()).toBe(1);

		if (phase === 'built') {
			clock += 1;
			queue.advance();
			expect(queue.readWaiting()).toBe(0);
			expect(queue.read(grove.id)?.length).toBeGreaterThan(0);
		}

		// Atomic swap preserves placement.id while changing assetId to an unbuildable house.
		document.apply([
			{ kind: 'remove', id: grove.id },
			{
				kind: 'place',
				assetId: 'house/court-neutral',
				host,
				seed: grove.seed,
				params: town.readBrushParams('house/court-neutral')
			}
		]);
		const after = new Map(cache.read().map((request) => [request.placement.id, request]));
		expect(after.get(grove.id)?.reason).toBeDefined();
		expect(after.get(grove.id)?.build).toBeUndefined();

		submitPlacementRequests(queue, after, detailsOf(after), serials, () => serial++);
		expect(queue.readWaiting()).toBe(0);
		expect(queue.read(grove.id)).toBeUndefined();

		clock += 1;
		queue.advance();
		expect(queue.read(grove.id)).toBeUndefined();
		expect(collectPlacedDrawables(after, queue, bodies, town.previewBody)).toEqual([]);
	}
);
