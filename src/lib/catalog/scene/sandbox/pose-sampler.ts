import { Box3, Matrix4, type Group } from 'three/webgpu';

export type Pose = (group: Group, seconds: number) => void;

/** Samples rigid inner poses once and retains swept bounds for stationary picking. */
export function poseSampler() {
	const motions: { group: Group; pose: Pose; local: Box3; previous: Box3; casts: boolean }[] = [];
	const swept = new Box3(),
		now = new Box3(),
		lastMatrix = new Matrix4();
	let shadowChanged = false;
	let lastTime: number | undefined;
	return {
		swept,
		get casts() {
			return shadowChanged;
		},
		add(group: Group, pose: Pose) {
			const local = new Box3().setFromObject(group);
			let casts = false;
			group.traverse((object) => {
				casts ||= object.castShadow;
			});
			motions.push({ group, pose, local, previous: local.clone(), casts });
		},
		get active() {
			return motions.length > 0;
		},
		sample(seconds: number) {
			swept.makeEmpty();
			shadowChanged = false;
			if (seconds === lastTime) return false;
			lastTime = seconds;
			let changed = false;
			for (const m of motions) {
				lastMatrix.copy(m.group.matrix);
				m.pose(m.group, seconds);
				m.group.updateMatrix();
				if (lastMatrix.equals(m.group.matrix)) continue;
				changed = true;
				now.copy(m.local).applyMatrix4(m.group.matrix);
				swept.union(m.previous).union(now);
				m.previous.copy(now);
				shadowChanged ||= m.casts;
			}
			return changed;
		}
	};
}
