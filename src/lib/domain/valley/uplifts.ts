import { defaults } from './settings';
import type { Random } from '../../core/random';
import { smoothstep } from './regional-profile';

const {
	massifCenterJitterBandM,
	massifRadiusBandM,
	massifAmplitudeBandRatio,
	maximumPeakHeightM,
	peakHeightReliefExponent,
	massifGridSpacingM,
	massifGridSideCount,
	massifGateStartM,
	massifGateStartReductionM,
	massifGateRiseRunM,
	massifSearchRadiusCells,
	massifSupportRadiusSquaredRatio,
	massifFalloffExponent
} = defaults;

// Exact arithmetic: a half turn spans every distinct orientation of an ellipse.
const axisBearing = /* Exact arithmetic: a non-oriented axis spans a half turn. */ {
	min: 0,
	max: Math.PI
};

function massif(random: Random, x: number, y: number, height: number) {
	const centerX =
		x + random.number({ min: massifCenterJitterBandM[0], max: massifCenterJitterBandM[1] });
	const centerY =
		y + random.number({ min: massifCenterJitterBandM[0], max: massifCenterJitterBandM[1] });
	const radiusX = random.number({ min: massifRadiusBandM[0], max: massifRadiusBandM[1] });
	const radiusY = random.number({ min: massifRadiusBandM[0], max: massifRadiusBandM[1] });
	const bearing = random.number(axisBearing);
	const amplitude =
		height * random.number({ min: massifAmplitudeBandRatio[0], max: massifAmplitudeBandRatio[1] });
	return {
		centerX,
		centerY,
		cos: Math.cos(bearing),
		sin: Math.sin(bearing),
		radiusX,
		radiusY,
		amplitude
	};
}

export function peakHeightM(relief: number) {
	return maximumPeakHeightM * relief ** peakHeightReliefExponent;
}

export function uplifts(random: Random, relief: number) {
	if (relief === 0) return () => 0;
	const height = peakHeightM(relief);
	const spacing = massifGridSpacingM;
	const side = massifGridSideCount;
	const offset = (side - 1) / 2;
	const massifs = Array.from({ length: side * side }, (_, i) =>
		massif(
			random.derive(String(i)),
			((i % side) - offset) * spacing,
			(Math.floor(i / side) - offset) * spacing,
			height
		)
	);
	return (x: number, y: number, fromTrough: number) => {
		const gate = smoothstep(
			(fromTrough - (massifGateStartM - massifGateStartReductionM * relief)) / massifGateRiseRunM
		);
		if (!gate) return 0;
		const centerX = Math.max(0, Math.min(side - 1, Math.round(x / spacing) + offset));
		const centerY = Math.max(0, Math.min(side - 1, Math.round(y / spacing) + offset));
		let uplift = 0;
		for (
			let row = Math.max(0, centerY - massifSearchRadiusCells);
			row <= Math.min(side - 1, centerY + massifSearchRadiusCells);
			row++
		) {
			for (
				let column = Math.max(0, centerX - massifSearchRadiusCells);
				column <= Math.min(side - 1, centerX + massifSearchRadiusCells);
				column++
			) {
				const { centerX, centerY, cos, sin, radiusX, radiusY, amplitude } =
					massifs[row * side + column];
				const dx = x - centerX;
				const dy = y - centerY;
				const distance =
					((dx * cos + dy * sin) / radiusX) ** 2 + ((dy * cos - dx * sin) / radiusY) ** 2;
				const t = Math.max(0, 1 - distance / massifSupportRadiusSquaredRatio);
				uplift += amplitude * t ** massifFalloffExponent;
			}
		}
		return uplift * gate;
	};
}
