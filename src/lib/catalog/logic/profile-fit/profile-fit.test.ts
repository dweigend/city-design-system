import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	roundProfileContact,
	roundPairContact,
	capsuleSkin,
	footprintPlanes,
	fitScale,
	surfaceBand
} from './index';
import type { Vec3 } from '../parametrik/types';

test('a circular pairing returns its exact separation and scales in metres', () => {
	assert.equal(roundPairContact(2, 0.5), 2);
	assert.equal(roundPairContact(6, 1.5), 6);
});
test('the rounded host touches inside a sloping segment at the analytic stationary height', () => {
	const fit = roundProfileContact(1, [
		{ height: 0, reach: 0.5 },
		{ height: 2, reach: 2.5 }
	]);
	assert(fit);
	assert(Math.abs(fit.height - (1 + 1 / Math.sqrt(2))) < 1e-12);
	assert(Math.abs(fit.offset - (1.5 + Math.sqrt(2))) < 1e-12);
	assert.equal(fit.segment, 0);
	assert.equal(fit.fraction, fit.height / 2);
	assert.equal(
		roundProfileContact(1, [
			{ height: 3, reach: 1 },
			{ height: 4, reach: 1 }
		]),
		undefined
	);
});
test('a ledge clips the contact to the last valid point; subdividing one face preserves the witness', () => {
	const profile = [
		{ height: 0, reach: 1.5 },
		{ height: 0.5, reach: 1.5 }
	];
	const fit = roundProfileContact(1, profile);
	assert.equal(fit?.height, 0.5);
	assert.equal(fit?.offset, 1.5 + Math.sqrt(0.75));
	assert.equal(
		roundProfileContact(1, [profile[0], { height: 0.25, reach: 1.5 }, profile[1]])?.offset,
		fit?.offset
	);
});
test('the same body fits a rotated, translated and reversed bay, and rejects an exterior anchor', () => {
	const corners: Vec3[] = [
		[0, 0, 0],
		[6, 0, 0],
		[7, 4, 0],
		[1, 4, 0]
	];
	const anchor: Vec3 = [3, 0.75, 2];
	const turn = ([x, y, z]: Vec3): Vec3 => [17 - y, 4 + x, z];
	const radius = (ring: Vec3[], a: Vec3) =>
		fitScale(footprintPlanes(ring, a), (n) => Math.hypot(...n), 2);
	assert.equal(radius(corners, anchor), 0.75);
	assert.equal(radius(corners.map(turn).reverse(), turn(anchor)), 0.75);
	assert.equal(radius(corners, [-12, 0, 0]), 0);
});
test('trim samples lie on the cylinder and its end cap; every edge of the annulus has two faces', () => {
	const mesh = surfaceBand(0.2, 0.4, 0, 0.08, (u, v, offset) => {
		const axial = 1 + u,
			d = capsuleSkin(1, 1, axial, v);
		assert(d !== undefined);
		return [axial, -d - offset, v];
	});
	const count = mesh.points.length / 4;
	for (const [i, [x, y, z]] of mesh.points.entries()) {
		const offset = i >= count && i < 3 * count ? 0.08 : 0;
		assert(Math.abs(Math.hypot(Math.max(0, Math.abs(x) - 1), y + offset, z) - 1) < 1e-12);
	}
	const edges = new Map<string, number>();
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const face = mesh.triangles.slice(i, i + 3);
		for (let j = 0; j < 3; j++) {
			const a = face[j],
				b = face[(j + 1) % 3],
				key = Math.min(a, b) + '/' + Math.max(a, b);
			edges.set(key, (edges.get(key) ?? 0) + Math.sign(b - a));
		}
	}
	assert([...edges.values()].every((count) => count === 0));
	assert.equal(capsuleSkin(1, 1, 3, 0), undefined);
});
