import { createFocusResolver } from '../focus';

/** The focus choices in menu order, named for what they show today: the three district kinds are
 * districts, not houses, which will join as their own subsystem. `subject` lists the subsystems
 * the choice puts in focus; a choice whose subject is absent is not offered. */
const choices = {
	all: { label: 'All', subject: [] },
	districts: { label: 'All districts', subject: ['detached', 'block', 'center'] },
	center: { label: 'Center district', subject: ['center'] },
	block: { label: 'Block district', subject: ['block'] },
	detached: { label: 'Detached district', subject: ['detached'] },
	lattice: { label: 'Lattice', subject: ['lattice'] },
	height: { label: 'Height', subject: ['detached', 'block', 'center'], analysis: 'height' },
	landscape: { label: 'Terrain and water', subject: ['terrain', 'water'] },
	parcels: { label: 'Parcels', subject: ['lanes', 'parcels', 'merged-units'] },
	plan: {
		label: 'Plan and crossings',
		subject: ['plan', 'water-cells', 'crossings', 'lanes', 'parcels', 'merged-units']
	}
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
		parcels: 'full',
		plan: 'full'
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
		parcels: 'full',
		plan: 'full'
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
		parcels: 'transparent',
		plan: 'transparent'
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
		parcels: 'transparent',
		plan: 'transparent'
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
		parcels: 'transparent',
		plan: 'transparent'
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
		parcels: 'hidden',
		plan: 'hidden'
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
		parcels: 'transparent',
		plan: 'full'
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
		parcels: 'hidden',
		plan: 'full'
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
		parcels: 'full',
		plan: 'full'
	},
	lanes: {
		all: 'hidden',
		districts: 'hidden',
		center: 'hidden',
		block: 'hidden',
		detached: 'hidden',
		lattice: 'hidden',
		height: 'hidden',
		landscape: 'hidden',
		parcels: 'full',
		plan: 'full'
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
		parcels: 'full',
		plan: 'full'
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
		parcels: 'full',
		plan: 'full'
	}
} as const;

/** City composition, ordered by its menu vocabulary and projection rows. */
export const cityFocusPreset = createFocusResolver(choices, policy);
