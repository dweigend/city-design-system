/** What a fine cell is to the house. `built` roles carry closed volume from `fromStorey` up; the
 * occupancy reads both fields here instead of deciding them per role. */
export const cellRoles = Object.freeze({
	wing: Object.freeze({
		built: true,
		fromStorey: /* Exact arithmetic: wing starts at ground level. */ 0,
		meaning: 'Built from the ground up'
	}),
	gate: Object.freeze({
		built: true,
		fromStorey: /* Exact arithmetic: passage ceiling starts above the ground story. */ 1,
		meaning: 'Built above an open passage to the court'
	}),
	raised: Object.freeze({
		built: true,
		fromStorey: /* Exact arithmetic: gallery bridge starts above the ground story. */ 1,
		meaning: 'Built above an open ground storey'
	}),
	passage: Object.freeze({
		built: false,
		fromStorey: /* Exact arithmetic: unbuilt passage has no story offset. */ 0,
		meaning: 'Open at every storey, leading to the court'
	}),
	court: Object.freeze({
		built: false,
		fromStorey: /* Exact arithmetic: open court has no story offset. */ 0,
		meaning: 'The open court, void to the sky'
	}),
	garden: Object.freeze({
		built: false,
		fromStorey: /* Exact arithmetic: open garden has no story offset. */ 0,
		meaning: 'Open ground outside the wings'
	})
});

/** Role of one fine cell. */
export type CellRole = keyof typeof cellRoles;
