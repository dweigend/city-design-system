import {
	Box2,
	MathUtils,
	PerspectiveCamera,
	Vector2,
	Vector3,
	type OrthographicCamera
} from 'three/webgpu';

const NEAR_PLANE = 0.1;
const FRAME_MARGIN = 1.12;

export type ContextPerspective = Readonly<{
	distance: number;
	/** Subject vertices in stage metres. The frame fits their projected silhouette. */
	points: readonly Vector3[];
}>;

/** Creates a perspective lens for a fixed stage context, at a distance in metres from its centre. */
export function createContextCamera({ distance, points }: ContextPerspective) {
	const camera = new PerspectiveCamera(50, 1, NEAR_PLANE);
	const projected = new Box2();
	const corner = new Vector3();
	const imagePoint = new Vector2();
	return {
		camera,
		/** Fits the subject at the shared view's orientation and current viewport aspect. */
		frame(source: OrthographicCamera, target: Vector3, aspect: number) {
			camera.position.copy(source.position).sub(target).setLength(distance).add(target);
			camera.quaternion.copy(source.quaternion);
			camera.updateMatrixWorld();
			projected.makeEmpty();
			let far = NEAR_PLANE;
			for (const point of points) {
				corner.copy(point).applyMatrix4(camera.matrixWorldInverse);
				const depth = -corner.z;
				if (!(depth > NEAR_PLANE && Number.isFinite(depth)))
					throw new RangeError(
						`Perspective subject depth must be finite and above ${NEAR_PLANE} m at eye distance ${distance} m`
					);
				projected.expandByPoint(imagePoint.set(corner.x / depth, corner.y / depth));
				far = Math.max(far, depth);
			}

			const size = projected.getSize(imagePoint);
			const height = Math.max(size.y, size.x / aspect) * FRAME_MARGIN;
			const center = projected.getCenter(imagePoint);
			camera.fov = MathUtils.radToDeg(2 * Math.atan(height / 2));
			camera.far = far + NEAR_PLANE;
			// Move the image window to the silhouette centre without moving the eye.
			camera.setViewOffset(aspect, 1, center.x / height, -center.y / height, aspect, 1);
		}
	};
}
