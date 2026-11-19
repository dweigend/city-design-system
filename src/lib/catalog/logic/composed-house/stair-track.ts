import { houseStair } from '../../data/house-stair';
type XY = [number, number];
export type Station = { xy: XY; normal: XY };

/** Rigid tread stations on two semicircles with optional straight facade runs. */
export function stairTrack([x, y]: XY, angle: number, straight: number) {
	const { going, radius } = houseStair;
	const result: Station[] = [];
	const tx = -Math.sin(angle),
		ty = Math.cos(angle);
	for (const sign of [1, -1]) {
		const start = angle + (sign === 1 ? 0 : Math.PI);
		for (let i = 0; i < 12 + straight; i++) {
			const a = start + (Math.PI * Math.min(i, 12)) / 12;
			const t = sign * (straight / 2 - Math.max(0, i - 12)) * going;
			const normal: XY = [Math.cos(a), Math.sin(a)];
			result.push({
				xy: [x + t * tx + radius * normal[0], y + t * ty + radius * normal[1]],
				normal
			});
		}
	}
	return result;
}

/** Offsets a walking station to the edge of its tread or landing in metres. */
export function edge(station: Station, offset: number): XY {
	return [station.xy[0] + station.normal[0] * offset, station.xy[1] + station.normal[1] * offset];
}
