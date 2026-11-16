import type { Vec3 } from '../parametrik/types';

/** Framing of a city scene in meters; the stage fits the tighter dimension. */
export type Rahmen = {
	/** View point (model, x east, y north, z up). */
	target: Vec3;
	/** Visible width and height in meters. */
	widthM: number;
	heightM: number;
	/** View direction in degrees: 0 = from the south, positive turns toward the east. */
	azimuthDeg?: number;
	/** Tilt in degrees above the horizon. */
	elevationDeg?: number;
};
