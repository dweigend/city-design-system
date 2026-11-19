import { suggestions } from './suggestions';
import { family, row } from '../assembly';
import { panel, post, bow, eye, lens, band } from './forms';

const asset = family('market-stands', 'deck', suggestions);
export const marketStands = [
	asset('ribbon-flower-stall', ['shell', 'fabric', 'body', 'slats'], [4.7, 2.9], (span) => [
		...row(2, (t) => panel(t * 1.85 * span, 0.7, 0, 0.13, 0.95, 2.3, 'shell')),
		bow(0, 0, 2.29, 4.15 * span, 2.5, 0.44, 'fabric'),
		panel(0, -0.18, 0, 3.5 * span, 0.68, 0.88, 'body'),
		panel(0, -0.24, 0.88, 3.8 * span, 0.95, 0.085)
	]),
	asset(
		'drum-espresso-kiosk',
		['body', 'slats', 'frame', 'shell'],
		[3.9, 3.9],
		(_span, variant) => [
			band(1.65, 0.18, 0, 1, 2.15 + variant * 1.1, 'body'),
			band(1.78, 0.52, 1, 0.09, 2.15 + variant * 1.1, 'slats'),
			...row(2 + variant, (t) => {
				const angle = (t + 1) * 0.5 * (2.15 + variant * 1.1);
				return post(1.52 * Math.cos(angle), 1.52 * Math.sin(angle), 1.09, 0.055, 1.36);
			}),
			lens(0, 0, 2.45, 1.83, 0.34)
		]
	),
	asset('paper-newsstand', ['body', 'foot', 'shell', 'slats'], [3.8, 2], (span, variant) => [
		panel(0, 0.5, 0, 3.3 * span, 0.8, 2.05, 'body'),
		panel(0, -0.22, 0, 3.35 * span, 0.58, 0.92, 'foot'),
		panel(0, 0, 2.05, 3.6 * span, 1.85, 0.13, 'shell'),
		...row(2 + variant, (t) => panel(t * 1.05 * span, 0.025, 1.14, 0.44, 0.12, 0.73))
	]),
	asset('orchard-cart', ['shell', 'body', 'slats', 'frame', 'fabric'], [3.8, 1.9], (span) => [
		...row(2, (t) => eye(t * 1.38 * span, 0, 0.34, 0.34, 0.12, 0.14)),
		panel(0, 0, 0.37, 2.9 * span, 1.3, 0.44, 'body'),
		panel(0, 0, 0.81, 3.15 * span, 1.43, 0.07),
		...row(2, (t) => post(t * 1.22 * span, 0.42, 0.88, 0.055, 1.2)),
		bow(0, 0, 2.08, 3.3 * span, 1.65, 0.32, 'fabric')
	]),
	asset('arc-ticket-booth', ['shell', 'foot', 'slats'], [4, 2.6], (span) => [
		bow(0, 0, 0, 3.65 * span, 2.2, 2.56, 'shell'),
		panel(0, 0.52, 0, 2.3 * span, 0.8, 0.96, 'foot'),
		panel(0, 0.35, 0.96, 2.55 * span, 1.12, 0.085)
	]),
	asset('tiered-produce-bar', ['body', 'slats', 'frame', 'shell'], [4, 2.3], (span) => [
		...row(3, (_, i) => panel(0, -0.71 + i * 0.63, 0, 3.55 * span, 0.64, 0.5 + i * 0.33, 'body')),
		...row(3, (_, i) => panel(0, -0.71 + i * 0.63, 0.5 + i * 0.33, 3.65 * span, 0.68, 0.06)),
		...row(2, (t) => post(t * 1.55 * span, 0.68, 1.22, 0.055, 1.1)),
		panel(0, 0.5, 2.32, 3.8 * span, 1.05, 0.09, 'shell')
	]),
	asset('corner-juice-kiosk', ['body', 'slats', 'frame', 'shell'], [4.2, 2.7], (span) => [
		panel(0, -0.67, 0, 3.7 * span, 0.65, 0.93, 'body'),
		panel(-1.54 * span, 0.2, 0, 0.66, 1.6, 0.93, 'body'),
		panel(0, -0.67, 0.93, 3.85 * span, 0.86, 0.08),
		post(-1.54 * span, 0.68, 0.93, 0.13, 1.58),
		panel(-0.25 * span, 0.2, 2.51, 3.7 * span, 2.15, 0.14, 'shell')
	]),
	asset('awning-bookstall', ['body', 'slats', 'fabric'], [4, 2.8], (span, variant) => [
		panel(0, 0.82, 0, 3.3 * span, 0.45, 2.25, 'body'),
		...row(3 + variant, (_, i) =>
			panel(0, 0.44, 0.3 + i * (1.55 / (2 + variant)), 3.3 * span, 0.68, 0.07)
		),
		panel(0, -0.12, 2.25, 3.7 * span, 2.43, 0.09, 'fabric')
	]),
	asset('split-tea-pavilion', ['frame', 'shell', 'body', 'slats'], [4.9, 3], (span) => [
		...row(2, (t) => post(t * 1.63 * span, 0, 0, 0.13, 2.3)),
		...row(2, (t) => lens(t * 1.1 * span, 0, 2.3, 1.15 * span, 0.33)),
		...row(2, (t) => post(t * 1.2 * span, 0, 0, 0.45, 0.9, 'body')),
		...row(2, (t) => post(t * 1.2 * span, 0, 0.9, 0.67, 0.07, 'slats'))
	]),
	asset('porch-exchange', ['foot', 'slats', 'shell'], [4.1, 2.8], (span, variant) => [
		...row(2, (t) => panel(t * 1.48 * span, 0.6, 0, 0.14, 1.45, 2.2, 'foot')),
		panel(0, 0.69, 1, 3.1 * span, 0.8, 0.085),
		panel(0, 0, 2.2, 3.7 * span, 2.55, 0.11, 'shell'),
		...row(2 + variant, (t) => panel(t * 1.05 * span, 0.91, 1.085, 0.06, 0.46, 0.68))
	])
];
