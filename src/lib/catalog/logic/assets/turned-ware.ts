import { family } from './assembly';
import { water, energy, food, workshop, path, living, pane } from './parts';
import { vessel } from './pottery';
const asset = family('ceramics', 'deck');
export const turnedWare = [
	asset('moon-flask', [2.48, 2.48], (factor) => [
		vessel(
			[
				[0.42, 0],
				[0.5, 0.15],
				[1.18, 1.15],
				[0.96, 1.78],
				[0.31, 2.15],
				[0.34, 2.36]
			],
			32,
			factor,
			water,
			0
		)
	]),
	asset('trumpet-vase', [2.68, 2.68], (factor) => [
		vessel(
			[
				[0.65, 0],
				[0.45, 0.24],
				[0.29, 1.2],
				[0.7, 2],
				[1.24, 2.5]
			],
			32,
			factor,
			living,
			0
		)
	]),
	asset('carinated-bowl', [2.88, 2.88], (factor) => [
		vessel(
			[
				[0.42, 0],
				[0.5, 0.15],
				[1.36, 0.73],
				[1.22, 1.02]
			],
			32,
			factor,
			workshop,
			0
		)
	]),
	asset('incense-cup', [1.68, 1.68], (factor) => [
		vessel(
			[
				[0.57, 0],
				[0.62, 0.12],
				[0.22, 0.3],
				[0.19, 0.72],
				[0.74, 1.15],
				[0.78, 1.46]
			],
			32,
			factor,
			path,
			0
		)
	]),
	asset('shoulder-jar', [2.48, 2.48], (factor) => [
		vessel(
			[
				[0.77, 0],
				[0.96, 0.22],
				[1.16, 1.58],
				[0.96, 1.84],
				[0.52, 1.98],
				[0.52, 2.25]
			],
			32,
			factor,
			energy,
			0
		)
	]),
	asset('stacked-bottle', [1.96, 1.96], (factor) => [
		vessel(
			[
				[0.48, 0],
				[0.91, 0.48],
				[0.5, 0.84],
				[0.89, 1.25],
				[0.43, 1.67],
				[0.73, 2],
				[0.25, 2.38],
				[0.25, 2.75]
			],
			32,
			factor,
			water,
			0
		)
	]),
	asset('lotus-basin', [3.28, 3.28], (factor, variant) => [
		vessel(
			[
				[0.7, 0],
				[0.43, 0.24],
				[0.65, 0.49],
				[1.55, 0.86],
				[1.45, 1.06]
			],
			8 + variant,
			factor,
			food,
			0
		)
	]),
	asset('square-flask', [2.48, 2.48], (factor, variant) => [
		vessel(
			[
				[0.75, 0],
				[1.15, 0.3],
				[1.15, 1.62],
				[0.42, 1.96],
				[0.42, 2.28]
			],
			4 + variant,
			factor,
			pane,
			0
		)
	]),
	asset('crystal-bud', [2.78, 2.78], (factor, variant) => [
		vessel(
			[
				[0.48, 0],
				[1.29, 0.84],
				[1.04, 1.67],
				[0.31, 2.49],
				[0.17, 2.62]
			],
			5 + variant,
			factor,
			workshop,
			0.27
		)
	]),
	asset('twisted-chalice', [2.6, 2.6], (factor, variant) => [
		vessel(
			[
				[0.68, 0],
				[0.73, 0.12],
				[0.28, 0.38],
				[0.28, 1.04],
				[1.22, 1.96],
				[1.04, 2.18]
			],
			6 + variant,
			factor,
			living,
			0.55
		)
	]),
	asset('fluted-urn', [2.08, 2.08], (factor, variant) => [
		vessel(
			[
				[0.63, 0],
				[0.91, 0.48],
				[0.98, 1.52],
				[0.61, 2.04],
				[0.64, 2.17]
			],
			10 + variant,
			factor,
			energy,
			0.16
		)
	]),
	asset('hourglass-column', [2.44, 2.44], (factor, variant) => [
		vessel(
			[
				[0.94, 0],
				[1.12, 0.19],
				[0.49, 1.58],
				[0.47, 2.12],
				[1.14, 3.81],
				[1.16, 4]
			],
			8 + variant,
			factor,
			water,
			0
		)
	]),
	asset('lotus-capital', [2.88, 2.88], (factor, variant) => [
		vessel(
			[
				[0.54, 0],
				[0.56, 0.54],
				[1.03, 0.91],
				[1.36, 1.18],
				[1.36, 1.47]
			],
			8 + variant,
			factor,
			food,
			0
		)
	]),
	asset('cushion-capital', [2.52, 2.52], (factor, variant) => [
		vessel(
			[
				[0.5, 0],
				[0.56, 0.32],
				[1.16, 0.75],
				[1.2, 1.11]
			],
			4 + variant,
			factor,
			living,
			0
		)
	]),
	asset('reed-column', [1.68, 1.68], (factor, variant) => [
		vessel(
			[
				[0.78, 0],
				[0.77, 0.22],
				[0.42, 0.4],
				[0.58, 1.94],
				[0.41, 3.42],
				[0.76, 3.67]
			],
			9 + variant,
			factor,
			path,
			0.35
		)
	]),
	asset('bell-finial', [2.08, 2.08], (factor) => [
		vessel(
			[
				[0.95, 0],
				[0.93, 0.23],
				[0.62, 0.55],
				[0.37, 1.41],
				[0.13, 1.72]
			],
			32,
			factor,
			energy,
			0
		)
	]),
	asset('pleated-dish', [3.18, 3.18], (factor, variant) => [
		vessel(
			[
				[0.68, 0],
				[0.71, 0.09],
				[1.48, 0.33],
				[1.51, 0.47]
			],
			10 + variant,
			factor,
			workshop,
			0.5
		)
	])
];
