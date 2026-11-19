import { Color } from 'three';
import { resolveTokens } from '../themeBinding';
import { TOENE, PROJEKTION_TOENE } from '../../data/leitstil';
import { flowStepToken, type FlowId, type FlowStep } from '../../data/focus';
import { neutral } from './tone';
import type { Stil } from '../../logic/leitstil';
export function grammatik(host: HTMLElement, s: Stil) {
	const names = [
		'--paper',
		'--ink',
		'--ink-2',
		'--ink-3',
		'--blueprint',
		'--body-living',
		'--signal',
		'--ana-zug',
		'--ana-druck',
		'--ana-null',
		'--cat-hazard',
		'--alpha-trace',
		...(['people', 'water', 'energy', 'food', 'material'] as const).flatMap((id) =>
			([1, 2, 3, 4, 5] as const).map((n) => flowStepToken(id, n))
		)
	];
	const tokens = resolveTokens(
		host,
		names.filter((n) => n !== '--alpha-trace')
	);
	const token = (name: string) => new Color(tokens[name]);
	const dunkel = s.thema === 'dunkel';
	// In dark mode, model white is dimmed to L=0.80 per INV-09. Ink and pencil invert their contrast order against the paper.
	return {
		token,
		paper: token('--paper'),
		ink: dunkel ? neutral(PROJEKTION_TOENE.dunkel.tusche) : token('--ink'),
		kontur: neutral(dunkel ? PROJEKTION_TOENE.dunkel.kontur : PROJEKTION_TOENE.hell.kontur),
		blei: neutral(
			dunkel
				? PROJEKTION_TOENE.dunkel.bleistift
				: s.rollen.bestand.token === 'bleistift-fokus'
					? TOENE.bestandFokus
					: TOENE.bleistift
		),
		modellL: dunkel ? PROJEKTION_TOENE.dunkel.modellweiss : TOENE.modellweiss,
		weiss: neutral(dunkel ? PROJEKTION_TOENE.dunkel.modellweiss : TOENE.modellweiss),
		schatten: neutral(dunkel ? PROJEKTION_TOENE.dunkel.schatten : TOENE.schatten),
		detail: token('--ink-2'),
		raster: token('--ink-3'),
		strom: (id: FlowId, n: FlowStep) => token(flowStepToken(id, n)),
		analyse: (art: 'zug' | 'druck' | 'null') => token(`--ana-${art}`),
		trace: Number(getComputedStyle(host).getPropertyValue('--alpha-trace')) || 0.18
	};
}
