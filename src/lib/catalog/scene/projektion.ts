import { Vector3, type Camera } from 'three';
import type { Vec3 } from '../logic/parametrik/types';

/**
 * World point (meters, z up) → image point in CSS pixels of a w × h area. Same axes as
 * scene/parametrik.ts: three (x, z, −y). For in-place labels laid over the scene as HTML.
 */
export function bildpunkt(camera: Camera, [x, y, z]: Vec3, w: number, h: number) {
	const v = new Vector3(x, z, -y).project(camera);
	return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, sichtbar: v.z > -1 && v.z < 1 };
}
