export type StudioQuality = 'phone' | 'desktop' | 'high';

/** Picks pattern detail for this stage; headless recipe compilation uses reference detail. */
export function studioQuality(): StudioQuality {
	if (typeof location === 'undefined') return 'desktop';
	const requested = new URLSearchParams(location.search).get('quality');
	if (requested === 'phone' || requested === 'high' || requested === 'desktop') return requested;
	return matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop';
}

/** Shared contact pigment and maximum opacity for the studio and surveyed bearing patches. */
export const contactInk = { color: 0x82776c, opacity: 0.25 } as const;

const lighting = {
	key: 0xfff5e9,
	intensity: 2.05,
	sky: 0xf1f5ff,
	ground: 0xf1e5d7,
	bounce: 1.65,
	bias: -0.0006,
	radius: 11,
	shadowTint: 0x716e78,
	shadowOpacity: 0.32
} as const;
const profiles = {
	phone: Object.freeze({
		...lighting,
		shadowSize: 1024,
		shadowTaps: 4,
		modelShadowSize: 1024,
		aoScale: 0.35,
		aoSamples: 6
	}),
	desktop: Object.freeze({
		...lighting,
		shadowSize: 2048,
		shadowTaps: 9,
		modelShadowSize: 2560,
		aoScale: 0.5,
		aoSamples: 12
	}),
	high: Object.freeze({
		...lighting,
		shadowSize: 4096,
		shadowTaps: 9,
		modelShadowSize: 4096,
		aoScale: 0.75,
		aoSamples: 18
	})
};

/** Resolves the canonical lighting and sampling configuration shared by every stage. */
export function studioConfig(quality = studioQuality()) {
	return profiles[quality];
}
