/** Full-height envelope and support systems, independent of colour and programme. */
export const shellSystems = [
	'tensile-sail',
	'inflated-cushion',
	'pleated-sheet',
	'woven-basket',
	'diagrid',
	'branching-frame',
	'lamella-vault',
	'suspended-curtain',
	'service-risers',
	'helical-services',
	'fan-truss',
	'arch-ribs',
	'sawtooth-fins',
	'cable-harp',
	'perforated-shell',
	'bundled-columns',
	'quarry-portals',
	'lapped-sails',
	'prismatic-lantern'
] as const;
export type ShellSystem = (typeof shellSystems)[number];
