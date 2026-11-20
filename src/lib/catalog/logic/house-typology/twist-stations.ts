type XY = [number, number];
type Station = { z: number; ring: XY[]; atBoundary: boolean; turn: number };

/** Rotates a section around the mean of the original surveyed corners. */
export function rotateSection(profile: XY[], ring: XY[], angle: number) {
	const centre: XY = [0, 0];
	for (const p of ring) {
		centre[0] += p[0] / ring.length;
		centre[1] += p[1] / ring.length;
	}

	const c = Math.cos(angle),
		s = Math.sin(angle);
	return profile.map(([u, v]): XY => {
		const x = u - centre[0],
			y = v - centre[1];
		return [centre[0] + x * c - y * s, centre[1] + x * s + y * c];
	});
}

/** Fits a single signed twist rate to all free sections, preserving the ground and access openings. */
export function twistStations(
	stations: Station[],
	ring: XY[],
	angle: number,
	fits: (candidate: XY[]) => boolean,
	coversSweep: (layers: Station[]) => boolean
) {
	if (!angle) return stations;
	const bottom = stations[0].z,
		height = stations[stations.length - 1].z - bottom;
	for (let scale = 1; scale >= 1 / 128; scale /= 2) {
		const turnAt = (z: number) => (angle * scale * (z - bottom)) / height;
		const twisted = stations.map((station) =>
			station.atBoundary
				? station
				: {
						...station,
						turn: turnAt(station.z),
						ring: rotateSection(station.ring, ring, turnAt(station.z))
					}
		);
		if (
			twisted.every((station) => station.atBoundary || fits(station.ring)) &&
			coversSweep(twisted)
		)
			return twisted;
	}
	return stations;
}
