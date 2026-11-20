import type { Primitive } from '../parametrik/types';

type TransitSlot = 'deck' | 'glass' | 'platform' | 'shaft' | 'halo' | 'hoop' | 'pillar';
export type TransitSlots = Record<TransitSlot, Pick<Primitive, 'token' | 'finish'>>;

const flow = { token: '--cat-business' } as const;
const paper = { token: '--paper' } as const;
export const drawingTransitSlots: TransitSlots = {
	deck: flow,
	glass: flow,
	platform: paper,
	shaft: flow,
	halo: flow,
	hoop: paper,
	pillar: paper
};

const steel = { ...paper, finish: 'metall-gebuerstet' } as const;
export const cityTransitSlots: TransitSlots = {
	...drawingTransitSlots,
	deck: { ...paper, finish: 'metall-kupfer' },
	glass: { ...paper, finish: 'clear-acrylic' },
	platform: steel,
	shaft: steel,
	halo: steel
};
