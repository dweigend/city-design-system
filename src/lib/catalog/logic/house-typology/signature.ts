import type { HouseEnvelope } from './envelope';

/** Names the actual structure, occupied section, edge contour and circulation in the composition. */
export function silhouette(envelope: HouseEnvelope) {
	return {
		support: envelope.system,
		deck: 'occupied courses',
		body: envelope.section,
		stair: 'ladder',
		outline: envelope.outline
	};
}
