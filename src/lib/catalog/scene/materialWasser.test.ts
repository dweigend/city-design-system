import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voreinstellung } from '../logic/material/rezept';
import { probeSzene } from '../logic/material/studien';
import { kanalOberflaeche } from './materialWasser';

test('replaying the canal restores its seeded surface without replacing its geometry', () => {
	const wasser = probeSzene('wasser', voreinstellung('wasser', 'neutral')).find(
		(s) => s.id === 'water-volume'
	);
	assert.ok(wasser);
	const kanal = kanalOberflaeche(wasser);
	assert.ok(kanal);
	const attribute = kanal.geometry.getAttribute('position');
	const start = attribute.array.slice();
	kanal.advance(0.1);
	assert.notDeepEqual(attribute.array, start);
	kanal.reset();
	assert.equal(kanal.geometry.getAttribute('position'), attribute);
	assert.deepEqual(attribute.array, start);
	kanal.geometry.dispose();
});
