import { expect, test } from 'bun:test';
import { reusePicture, reuseSteps } from './reuse';

const seed = 139;
const chain = [
	reusePicture('deconstruction', seed),
	reusePicture('storage', seed),
	reusePicture('transport', seed),
	reusePicture('reinstallation', seed)
] as const;

test('the same precast bay and mass are tracked through all four reuse steps', () => {
	for (const frame of chain) {
		expect(frame.component).toEqual({ id: 'component/bay-04', massKg: 1420, reinstallable: true });
		expect(frame.drawables.filter(({ id }) => id === frame.component.id)).toHaveLength(1);
	}
});

test('each step shows a distinct condition and placement in the fixed yard', () => {
	const placements = new Set(chain.map(({ origin }) => origin.join(',')));
	expect(placements.size).toBe(chain.length);
	expect(new Set(chain.map(({ condition }) => condition)).size).toBe(chain.length);

	const conditionParts = [
		['donor/open-socket/0-0', 'component/bay-04/old-shim/0', 'dismantling-hoist/sling/0'],
		['depot/canopy', 'depot/rack/0', 'component/bay-04/inspection-tag'],
		['rail-sled/cradle/0', 'component/bay-04/transport-strap/0'],
		['receiver/joined-socket/0-0', 'receiver/post/0']
	];
	for (const [index, frame] of chain.entries()) {
		const ids = frame.drawables.map(({ id }) => id);
		expect(ids).toEqual(expect.arrayContaining(conditionParts[index]));
		expect(new Set(ids).size).toBe(ids.length);
		expect(frame.fit).toEqual(chain[0].fit);
	}

	const bodyShapes = chain.map(
		({ component, drawables }) => drawables.find(({ id }) => id === component.id)?.shape
	);
	expect(new Set(bodyShapes.map((shape) => JSON.stringify(shape))).size).toBe(chain.length);
});

test('roadless transport seats the sled on the district guide rails', () => {
	const transport = reusePicture('transport', seed);
	for (const side of [0, 1]) {
		const rail = transport.drawables.find(({ id }) => id === `guide-rail/rail/${side}`)?.shape;
		const shoe = transport.drawables.find(({ id }) => id === `rail-sled/guide-shoe/${side}`)?.shape;
		const jamb = transport.drawables.find(
			({ id }) => id === `${transport.component.id}/jamb/${side}`
		)?.shape;
		const brace = transport.drawables.find(({ id }) => id === `rail-sled/brace/${side}`)?.shape;
		if (
			rail?.kind !== 'box' ||
			shoe?.kind !== 'box' ||
			jamb?.kind !== 'box' ||
			brace?.kind !== 'mesh'
		)
			throw new Error('Missing rail, guide shoe, jamb or sled brace');
		expect(shoe.center[1]).toBe(rail.center[1]);
		expect(shoe.center[2] - shoe.size[2] / 2).toBeCloseTo(rail.center[2] + rail.size[2] / 2);
		const rearFaceY = jamb.center[1] + jamb.size[1] / 2;
		const meetsJambRear = brace.vertices.some(
			([vx, vy, vz]) =>
				Math.abs(vx - jamb.center[0]) <= jamb.size[0] / 2 + 0.15 &&
				Math.abs(vy - rearFaceY) <= 0.15 &&
				vz >= jamb.center[2] - jamb.size[2] / 2 &&
				vz <= jamb.center[2] + jamb.size[2] / 2
		);
		expect(meetsJambRear).toBe(true);
	}
	expect(transport.drawables.some(({ id }) => /(^|\/)(road|truck)(\/|$)/.test(id))).toBe(false);
});

test('the bay and its four visible flanges use the material flow token', () => {
	for (const { drawables, component } of chain) {
		const body = drawables.find(({ id }) => id === component.id);
		const flanges = drawables.filter(({ id }) => id.startsWith(`${component.id}/flange/`));
		expect(body?.color).toBe('--cat-living');
		expect(flanges.map(({ color }) => color)).toEqual(Array(4).fill('--cat-living'));
		expect(flanges.every(({ shape }) => shape.kind === 'box' && shape.size[1] > 0.56)).toBe(true);
	}
});

test('the separated flanges fit the matching sockets in the receiving building', () => {
	for (const frame of [chain[0], chain[3]]) {
		const isSeated = frame.step === 'reinstallation';
		const socketPrefix = isSeated ? 'receiver/joined-socket/' : 'donor/open-socket/';
		for (const joint of ['0-0', '0-1', '1-0', '1-1']) {
			const flange = frame.drawables.find(
				({ id }) => id === `${frame.component.id}/flange/${joint}`
			)?.shape;
			const socket = frame.drawables.find(({ id }) => id === `${socketPrefix}${joint}`)?.shape;
			if (flange?.kind !== 'box' || socket?.kind !== 'box')
				throw new Error(`Missing joint ${joint}`);
			const meetsSocket = flange.center.every(
				(value, axis) =>
					Math.abs(value - socket.center[axis]) <= (flange.size[axis] + socket.size[axis]) / 2
			);
			expect(meetsSocket).toBe(isSeated);
		}
	}
});

test('a fractured bay is quarantined for raw material recovery', () => {
	const { component, drawables, condition } = reusePicture('rejected', seed);
	expect(component).toEqual({ id: 'component/bay-09', massKg: 1380, reinstallable: false });
	expect(condition).toMatch(
		/Fractured joint.*Unsuitable for reinstallation.*Raw material recovery/
	);
	expect(drawables.find(({ id }) => id === component.id)?.shape.kind).toBe('mesh');
	expect(
		drawables.find(({ id }) => id === `${component.id}/fracture/displaced-lintel`)?.shape.kind
	).toBe('mesh');
	expect(drawables.find(({ id }) => id === `${component.id}/failed-flange`)?.color).toBe(
		'--signal'
	);
	expect(
		drawables.some(({ id }) => id.startsWith('receiver/') || id.startsWith(chain[0].component.id))
	).toBe(false);
});

test('fixed seed illustrations are deterministic across calls', () => {
	for (const step of reuseSteps) expect(reusePicture(step, seed)).toEqual(reusePicture(step, seed));
	expect(reusePicture('rejected', seed).drawables).not.toEqual(
		reusePicture('rejected', seed + 1).drawables
	);
});
