/**
 * Variants of the design system. Each variant has a fixed role;
 * all of them can be used side by side.
 */
export type TagVariant = 'status' | 'category';
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon' | 'bare';
export type SwitchVariant = 'box' | 'labeled';
export type SliderVariant = 'ruler' | 'bar' | 'readout';
export type TabsVariant = 'index' | 'underline';
export type TooltipVariant = 'label' | 'callout';
export type SelectionVariant = 'frame' | 'mark';
export type IconVariant = 'color' | 'silhouette';
export type TimelineVariant = 'ruler' | 'epochs';
export type HudMode = 'play' | 'plan';

/** Tone for markers: meaning, not decoration. */
export type Tone =
	'blueprint' | 'signal' | 'living' | 'health' | 'mobility' | 'business' | 'nature' | 'hazard';

const isMode = (tone: Tone) => tone === 'blueprint' || tone === 'signal';

/** Color of a tone as a CSS variable. */
export const toneVar = (tone: Tone) => (isMode(tone) ? `var(--${tone})` : `var(--cat-${tone})`);

/** Text color on the tone: paper on the deep tones (signal, blueprint, hazard), ink otherwise. */
export const onToneVar = (tone: Tone) =>
	isMode(tone) || tone === 'hazard' ? 'var(--on-accent)' : 'var(--on-cat)';

/** One section of the overview: index, title, variants (A, B …). */
export type Section<T extends string = string> = {
	id: string;
	index: string;
	title: string;
	variants: { id: T; name: string }[];
};

export type { Style3D } from './city3d';
