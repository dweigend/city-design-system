/** Fixed metre dimensions of the stair stock, measured at the walking line. */
export const houseStair = {
	width: 1.25,
	going: 0.29,
	rise: 0.17,
	radius: 0.29 / (2 * Math.sin(Math.PI / 24)),
	thickness: 0.035,
	rail: 1.1
} as const;
