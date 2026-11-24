import { createFocusResolver } from '../focus';

const choices = {
	all: { label: 'All', subject: [] },
	districts: { label: 'All districts', subject: ['detached', 'block', 'center'] },
	center: { label: 'Center district', subject: ['center'] },
	block: { label: 'Block district', subject: ['block'] },
	detached: { label: 'Detached district', subject: ['detached'] },
	lattice: { label: 'Lattice', subject: ['lattice'] },
	height: { label: 'Height', subject: ['detached', 'block', 'center'], analysis: 'height' },
	landscape: { label: 'Terrain and water', subject: ['terrain', 'water'] },
	plan: { label: 'Plan and crossings', subject: ['lanes', 'parcels'] },
	paths: { label: 'Paths and rail', subject: ['lanes', 'walkways', 'transit'] },
	rail: { label: 'Rail', subject: ['transit'] }
} as const;

const policy = {
	terrain: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'full',
		height: 'full',
		landscape: 'full',
		plan: 'full',
		paths: 'full',
		rail: 'full'
	},
	water: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'full',
		height: 'full',
		landscape: 'full',
		plan: 'full',
		paths: 'full',
		rail: 'full'
	},
	detached: {
		all: 'full',
		districts: 'full',
		center: 'transparent',
		block: 'transparent',
		detached: 'full',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette',
		plan: 'transparent',
		paths: 'transparent',
		rail: 'silhouette'
	},
	block: {
		all: 'full',
		districts: 'full',
		center: 'transparent',
		block: 'full',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette',
		plan: 'transparent',
		paths: 'transparent',
		rail: 'silhouette'
	},
	center: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'transparent',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'full',
		landscape: 'silhouette',
		plan: 'transparent',
		paths: 'transparent',
		rail: 'silhouette'
	},
	lattice: {
		all: 'full',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'full',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'hidden',
		paths: 'hidden',
		rail: 'hidden'
	},
	plan: {
		all: 'transparent',
		districts: 'transparent',
		center: 'transparent',
		block: 'transparent',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'transparent',
		landscape: 'transparent',
		plan: 'full',
		paths: 'hidden',
		rail: 'hidden'
	},
	'water-cells': {
		all: 'hidden',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'full',
		plan: 'full',
		paths: 'hidden',
		rail: 'hidden'
	},
	crossings: {
		all: 'full',
		districts: 'full',
		center: 'transparent',
		block: 'transparent',
		detached: 'transparent',
		lattice: 'transparent',
		height: 'transparent',
		landscape: 'full',
		plan: 'full',
		paths: 'full',
		rail: 'transparent'
	},
	lanes: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'full',
		paths: 'full',
		rail: 'hidden'
	},
	walkways: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'full',
		paths: 'full',
		rail: 'hidden'
	},
	transit: {
		all: 'full',
		districts: 'full',
		center: 'full',
		block: 'full',
		detached: 'full',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'full',
		paths: 'full',
		rail: 'full'
	},
	parcels: {
		all: 'hidden',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'full',
		paths: 'hidden',
		rail: 'hidden'
	},
	'merged-units': {
		all: 'hidden',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		plan: 'full',
		paths: 'hidden',
		rail: 'hidden'
	}
} as const;

/** The Paths composition includes city context, measured lanes, upper paths and transit. */
export const pathsFocusPreset = createFocusResolver(choices, policy);

/** A selectable focus in the Paths composition. */
export type PathsFocusChoice = (typeof pathsFocusPreset.choices)[number];
