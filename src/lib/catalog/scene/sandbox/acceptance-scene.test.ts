import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { Group, Vector3 } from 'three/webgpu';
import { acceptanceScene, TWO_SUNS_TURNING_DISC } from '../../logic/sandbox';
import { kineticGroups } from './kinetic-groups';

test('Two Suns stands on the surveyed cell and only the blue disc orbits in 90 seconds', () => {
	const { world, additions } = acceptanceScene();
	const cell = world.grid.cellsById.get('111/42');
	assert(cell);
	const { center } = cell;
	const parts = additions.filter(({ id }) => id.startsWith('two-suns:'));
	const [plinth, mast, finial, fixed, turning] = parts;
	expect(parts).toHaveLength(5);
	expect(plinth).toMatchObject({ kind: 'cylinder', position: center, radius: 3, height: 0.6 });
	if (finial.kind !== 'sphere' || turning.kind !== 'ring') throw Error('Missing landmark geometry');
	expect(finial.position[2] + finial.radius - center[2]).toBeCloseTo(18);
	expect(finial.position[2] + finial.radius - center[2]).toBeLessThanOrEqual(20);
	expect(mast).toMatchObject({ token: '--ink', height: 16.4 });
	expect(fixed).toMatchObject({ token: '--cat-mobility', radius: 5 });
	expect(turning).toMatchObject({ token: '--cat-health', id: TWO_SUNS_TURNING_DISC });

	const { batches, motion } = kineticGroups('study', parts, () => new Group(), undefined, false);
	const [rigid, orbit] = batches;
	motion.sample(0);
	const original = orbit.matrix.clone();
	const staticPose = rigid.matrix.clone();
	const [x, y, z] = turning.position;
	motion.sample(22.5);
	const quarterTurn = new Vector3(x, z, -y).applyMatrix4(orbit.matrix);
	expect(quarterTurn.x).toBeCloseTo(center[0]);
	expect(quarterTurn.z).toBeCloseTo(-center[1] - 2.5);
	expect(orbit.matrix.equals(original)).toBe(false);
	expect(rigid.matrix.equals(staticPose)).toBe(true);
	motion.sample(90);
	expect(orbit.matrix.equals(original)).toBe(true);
});
