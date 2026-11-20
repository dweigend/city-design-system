type Point = [number, number];

const knot: Record<number, Point[]> = {
	7: [
		[0, 0.28],
		[0.18, 0.65],
		[0.36, 1],
		[0.45, 0.4],
		[0.62, 0],
		[0.85, 0.35],
		[1, 0.65]
	],
	15: [
		[0, 0.42],
		[0.14, 0.23],
		[0.18, 0.58],
		[0.2, 0.82],
		[0.32, 1],
		[0.33, 0.04],
		[0.4, 0.35],
		[0.46, 0.63],
		[0.56, 0.85],
		[0.58, 0],
		[0.66, 0.24],
		[0.73, 0.5],
		[0.78, 0.77],
		[0.91, 0.29],
		[1, 0.56]
	]
};
const groups: Record<number, Point[]> = {
	7: [
		[0, 0.28],
		[0.16, 0],
		[0.19, 0.5],
		[0.65, 0.72],
		[0.76, 0.38],
		[0.82, 1],
		[1, 0.7]
	],
	15: [
		[0, 0.27],
		[0.09, 0],
		[0.15, 0.43],
		[0.2, 0.19],
		[0.23, 0.63],
		[0.35, 0.4],
		[0.36, 0.11],
		[0.65, 0.56],
		[0.69, 0.83],
		[0.77, 0.37],
		[0.81, 0.66],
		[0.82, 1],
		[0.93, 0.5],
		[0.96, 0.87],
		[1, 0.25]
	]
};

function ring(count: number): Point[] {
	if (count === 7)
		return [
			[1, 0.5],
			[0.8, 0.86],
			[0.32, 1],
			[0, 0.73],
			[0, 0.27],
			[0.32, 0],
			[0.8, 0.14]
		];
	const points = Array.from({ length: count }, (_, i): Point => {
		const angle = (2 * Math.PI * i) / count;
		return [Math.cos(angle), Math.sin(angle)];
	});
	const low = Math.min(...points.map((p) => p[0]));
	const high = Math.max(...points.map((p) => p[1]));
	return points.map(([x, y]) => [(x - low) / (1 - low), (y / high + 1) / 2]);
}

/** Compact figure origins around the stepped courts and open meeting places in reference v5. */
export function plazaLayout(count: number, variant: number): Point[] {
	if (variant === 2) return ring(count);
	return (variant === 0 ? knot : groups)[count];
}
