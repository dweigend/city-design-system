import { expect, test } from 'bun:test';
import { Box2, Vector2 } from 'three/webgpu';
import { openingOrigins } from './opening-origins';
import { screenBounds } from './opening-projection';
import { createView } from './view';

test('a short opening translates both ensembles clear of the timeline without a stock roof', () => {
	const view = createView();
	view.resize(1280, 640);
	const timeline = { left: 16, top: 562, right: 665, bottom: 624 };
	const screen = screenBounds(view, { top: 40, bottom: 640, right: 1097, reserved: [timeline] });
	const courts = [
		new Box2(new Vector2(20, 100), new Vector2(330, 530)),
		new Box2(new Vector2(400, 210), new Vector2(800, 572))
	];
	const pair = courts[0].clone().union(courts[1]);
	const data = {
		courts,
		houses: courts.map((b) => [b]),
		stock: [],
		centres: [],
		landmarks: [],
		landscape: []
	};
	const origins = [...openingOrigins(pair, screen, data, 1, false)];
	expect(origins.length).toBeGreaterThan(0);
	for (const origin of origins) {
		for (const court of courts) {
			const roof = court.clone().translate(origin.clone().negate());
			expect(screen.safe.containsBox(roof)).toBe(true);
			expect(screen.reserved.some((hud) => hud.intersectsBox(roof))).toBe(false);
		}
	}
});
