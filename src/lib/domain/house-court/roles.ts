/** What a fine cell is to the house. `built` roles carry closed volume in some storeys. */
export const cellRoles = Object.freeze({
	wing: Object.freeze({ built: true, meaning: 'Built from the ground up' }),
	gate: Object.freeze({ built: true, meaning: 'Built above an open ground-storey passage' }),
	passage: Object.freeze({ built: false, meaning: 'Open at every storey, leading to the court' }),
	court: Object.freeze({ built: false, meaning: 'The open court, void to the sky' }),
	garden: Object.freeze({ built: false, meaning: 'Open ground outside the wings' })
});

/** Role of one fine cell. */
export type CellRole = keyof typeof cellRoles;
