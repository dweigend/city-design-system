import { block, plate, row } from './assembly';
import { mount, type AssetRecipe } from './definition';
import { rod, surface } from './parts';

const stock = { category: 'access', anchors: [mount('deck')] } as const;

function landing(variant: number) {
	const x = variant === 1 ? 1.25 : 0.625;
	const y = 0.625;
	const corner: [number, number][] =
		variant === 2
			? [
					[x, y - 0.375],
					[x - 0.375, y]
				]
			: [[x, y]];
	return [plate([[-x, -y], [x, -y], ...corner, [-x, y]], 0, 0.2, 'deck')];
}

function ramp(variant: number) {
	const run = 2.5 * (variant + 1);
	function wedge(y: number, width: number, lip: number) {
		const height = 0.08 * run + lip;
		return {
			...surface('deck'),
			kind: 'wedge' as const,
			position: [-run / 2, y, 0] as [number, number, number],
			size: [run, width, height] as [number, number, number],
			low: lip / height
		};
	}
	return [wedge(-0.425, 0.85, 0), wedge(-0.625, 0.2, 0.2), wedge(0.425, 0.2, 0.2)];
}

function railing(variant: number) {
	if (variant === 1) return [block(0, 0, 0, 2.5, 0.12, 1.1, 'frame')];
	if (variant === 2)
		return [
			...row(7, (t) => block(1.175 * t, 0, 0.12, 0.12, 0.12, 0.86, 'frame')),
			...[0, 0.49, 0.98].map((z) => block(0, 0, z, 2.5, 0.12, 0.12, 'frame'))
		];
	const pitch = variant < 3 ? 0 : (Math.floor((variant - 3) / 2) * Math.PI) / 12;
	const span = variant < 3 ? 2.38 : variant % 2 ? 0.72 : 0.18;
	const half = (span * Math.cos(pitch)) / 2,
		rise = span * Math.sin(pitch);
	return [
		rod([-half, 0, 0.92], [half, 0, 0.92 + rise], 0.06, 'frame'),
		rod([-half, 0, 0], [-half, 0, 0.92], 0.06, 'frame'),
		rod([half, 0, rise], [half, 0, 0.92 + rise], 0.06, 'frame')
	];
}

export const circulationObjects: AssetRecipe[] = [
	{
		...stock,
		id: 'landing',
		footprint: [2.5, 1.25],
		variants: ['standard', 'mast-platform', 'corner'],
		slotNames: ['deck'],
		draw: landing
	},
	{
		...stock,
		id: 'ramp',
		footprint: [7.5, 1.25],
		variants: ['standard', 'medium', 'long'],
		slotNames: ['deck'],
		draw: ramp
	},
	{
		...stock,
		id: 'railing',
		footprint: [2.5, 0.15],
		variants: [
			'standard',
			'parapet',
			'screen',
			...Array.from({ length: 6 }, (_, i) =>
				['short-post', 'closure-post'].map((name) => (i ? name + '-' + 15 * i : name))
			).flat()
		],
		slotNames: ['frame'],
		draw: railing
	}
];
