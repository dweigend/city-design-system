/** What a fine cell is to the house. `built` roles carry closed volume from `fromStorey` up; the
 * occupancy reads both fields here instead of deciding them per role. */
export const cellRoles = Object.freeze({
	wing: Object.freeze({ built: true, fromStorey: 0, meaning: 'Built from the ground up' }),
	gate: Object.freeze({ built: true, fromStorey: 1, meaning: 'Built above an open passage to the court' }),
	raised: Object.freeze({ built: true, fromStorey: 1, meaning: 'Built above an open ground storey' }),
	passage: Object.freeze({ built: false, fromStorey: 0, meaning: 'Open at every storey, leading to the court' }),
	court: Object.freeze({ built: false, fromStorey: 0, meaning: 'The open court, void to the sky' }),
	garden: Object.freeze({ built: false, fromStorey: 0, meaning: 'Open ground outside the wings' })
});

/** Role of one fine cell. */
export type CellRole = keyof typeof cellRoles;
