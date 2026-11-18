import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import { studienZufall } from './studienZufall';

const rauschWahl = [
	{ value: 'quiet', label: 'Subtle' },
	{ value: 'native', label: 'Reference' },
	{ value: 'strong', label: 'Pronounced' }
] as const;

export type MaterialVariation = {
	readonly noise: (typeof rauschWahl)[number]['value'];
	readonly seed: number;
};

export const variationVorgabe: MaterialVariation = { noise: 'native', seed: 0 };
export const maximaleMusterSaat = 65535;

export const rauschStaerke: Record<MaterialVariation['noise'], number> = {
	quiet: 0.4,
	native: 1,
	strong: 1.65
};

const festeMuster: ReadonlySet<AusfuehrungId> = new Set([
	'metall-messing',
	'keramik-schachbrett',
	'glas-klar',
	'glas-photovoltaik',
	'wasser-ruhig',
	'bestand-matt'
]);

/** True for finishes whose grain or pigment can vary. Grid spacing, optics and fluids stay authored. */
export function variationFaehig(id: AusfuehrungId): boolean {
	return !festeMuster.has(id);
}

/** Returns detached controls. Unsupported noise and non-finite seeds use defaults; seeds round into 0–65535. */
export function materialVariation(
	noise: string = variationVorgabe.noise,
	seed: number = variationVorgabe.seed
): MaterialVariation {
	const stufe = rauschWahl.find((a) => a.value === noise)?.value ?? variationVorgabe.noise;
	const ganz = Number.isFinite(seed) ? Math.round(seed) : variationVorgabe.seed;
	return { noise: stufe, seed: Math.max(0, Math.min(maximaleMusterSaat, ganz)) };
}

/**
 * Detached pattern origin offset in meters for a validated seed. 0 retains the authored origin;
 * other seeds use three fixed counter samples without advancing any generator or changing geometry.
 */
export function musterVersatzM(seed: number): [number, number, number] {
	const versatz = (achse: number) => (studienZufall(seed, achse) - 0.5) * 18;
	return seed === 0 ? [0, 0, 0] : [versatz(0), versatz(1), versatz(2)];
}
