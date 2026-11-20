export type StudioQuality = 'phone' | 'desktop' | 'high';

/** Picks pattern detail for this stage; headless recipe compilation uses reference detail. */
export function studioQuality(): StudioQuality {
	if (typeof location === 'undefined') return 'desktop';
	const requested = new URLSearchParams(location.search).get('quality');
	if (requested === 'phone' || requested === 'high' || requested === 'desktop') return requested;
	return matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop';
}

const lighting = {
	key: 0xfff1de,
	intensity: 2.2,
	sky: 0xf3f6ff,
	ground: 0xe8d8bd,
	bounce: 1.65,
	bias: -0.0006,
	radius: 7.5,
	shadowTint: 0x6b6359,
	shadowOpacity: 0.62
} as const;
const profiles = {
	phone: Object.freeze({ ...lighting, shadowSize: 1024, aoScale: 0.35, aoSamples: 6 }),
	desktop: Object.freeze({ ...lighting, shadowSize: 2048, aoScale: 0.5, aoSamples: 12 }),
	high: Object.freeze({ ...lighting, shadowSize: 4096, aoScale: 0.75, aoSamples: 18 })
};

/** Resolves the canonical lighting and sampling configuration shared by every stage. */
export function studioConfig(quality = studioQuality()) {
	return profiles[quality];
}
