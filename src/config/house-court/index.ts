import { defineSettings, joinSettings, settingValues } from '../setting';
import { archigram, memphis, organic, shapes } from './styles';

const occupancy = defineSettings({
	rearDropRatio: {
		value: 0.75,
		unit: 'ratio',
		meaning:
			'Share of the storeys above the first that the rearmost cell loses at complexity 1, falling linearly from the frontage',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-1',
		rationale: 'Height steps from the street toward the rear neighbour instead of one flat ring.'
	},
	courtStepComplexityRatio: {
		value: 0.3,
		unit: 'ratio',
		meaning: 'Complexity from which built cells facing the court step down',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-1'
	},
	courtStepStoreys: {
		value: 1,
		unit: 'storeys',
		meaning: 'Storeys a court-facing cell loses above the court-step complexity',
		bounds: { min: 0 },
		principle: 'FORM-1'
	},
	jitterComplexityRatio: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Complexity from which seeded cells rise or fall by one storey',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-2'
	},
	jitterShareRatio: {
		value: 0.45,
		unit: 'ratio',
		meaning: 'Share of cells that rise or fall by one storey at complexity 1',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-2'
	},
	galleryComplexityRatio: {
		value: 0.45,
		unit: 'ratio',
		meaning: 'Complexity from which upper storeys open onto a gallery around the court',
		bounds: { min: 0, max: 1 },
		principle: 'COLOR-3'
	}
});

const town = defineSettings({
	calmAreaM2: {
		value: 450,
		unit: 'm²',
		meaning:
			'Largest cell space of a calm house: it draws one fill, roof and opening kind and few colours, and keeps the eaves line',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-2',
		rationale:
			'Perimeter parcels are 100–320 m²; neighbours vary by seed, not by noise inside one small house.'
	},
	cellsPerColour: {
		value: 3,
		unit: 'count',
		meaning: 'Cells per body colour of a calm house; two cells take one colour, six take two',
		bounds: { min: 1 },
		principle: 'COLOR-4'
	},
	eavesToleranceStoreys: {
		value: 1,
		unit: 'storeys',
		meaning:
			'Largest seeded drop of a calm house below the block height; frontage cells share that eaves line',
		bounds: { min: 0 },
		principle: 'FORM-2',
		rationale: 'A row of houses reads as one street front when eaves differ by at most a storey.'
	},
	cornerRiseStoreys: {
		value: 1,
		unit: 'storeys',
		meaning: 'Storeys a calm house on a block corner rises above the eaves line',
		bounds: { min: 0 },
		principle: 'FORM-2'
	},
	largeUnitAreaM2: {
		value: 4000,
		unit: 'm²',
		meaning:
			'Cell space area from which one large building fills the whole unit with the style row large tendency',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-1',
		rationale:
			'Merged units and halls span several coarse cells; one coarse cell (about 3,600 m²) stays a court house.'
	},
	largeStoreys: {
		value: 2,
		unit: 'storeys',
		meaning: 'Storeys of a large building below its roof figure',
		bounds: { min: 1 },
		principle: 'FORM-1'
	},
	largeOpeningScaleRatio: {
		value: 2,
		unit: 'ratio',
		meaning: 'Scale of opening pitch, width and height on a large building: a few big openings',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-3'
	},
	entranceStepRiseM: {
		value: 0.15,
		unit: 'm',
		meaning:
			'Rise from the lane to the ground storey above which the entrance takes steps inside its cell',
		bounds: { min: 0 },
		principle: 'COLOR-3',
		rationale: 'One kerb height; below it a sill suffices.'
	}
});

const skin = defineSettings({
	floorEdgeOutsetM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Outward projection of a floor-edge band beyond an exposed wall',
		bounds: { min: 0 },
		principle: 'FORM-6',
		rationale: 'Reads as a line of the storey at quarter zoom.'
	},
	floorEdgeThicknessM: {
		value: 0.3,
		unit: 'm',
		meaning: 'Height of a floor-edge band',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-6'
	},
	roofEdgeOutsetM: {
		value: 0.28,
		unit: 'm',
		meaning: 'Outward projection of the roof edge beyond an exposed wall',
		bounds: { min: 0 },
		principle: 'FORM-6'
	},
	roofEdgeThicknessM: {
		value: 0.5,
		unit: 'm',
		meaning: 'Height of the roof edge slab',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-6'
	},
	windowPitchM: {
		value: 2.7,
		unit: 'm',
		meaning: 'Wall length per opening along an exposed side',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-3'
	},
	windowWidthM: {
		value: 1.3,
		unit: 'm',
		meaning: 'Width of an upper-storey opening',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-3'
	},
	windowHeightM: {
		value: 1.6,
		unit: 'm',
		meaning: 'Height of an upper-storey opening',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-3'
	},
	windowSillM: {
		value: 0.9,
		unit: 'm',
		meaning: 'Sill height of an upper-storey opening above its floor',
		bounds: { min: 0 },
		principle: 'FORM-3'
	},
	groundOpeningHeightM: {
		value: 2.5,
		unit: 'm',
		meaning: 'Height of a ground-storey opening, standing on the floor',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-3'
	},
	openingDepthM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Thickness of an opening pane, centred on the wall plane',
		bounds: { exclusiveMin: 0 },
		rationale: 'Thin enough to read as a pane, thick enough to avoid depth fighting with the wall.'
	},
	galleryDepthM: {
		value: 1.6,
		unit: 'm',
		meaning: 'Projection of a court gallery from its wall',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	galleryThicknessM: {
		value: 0.22,
		unit: 'm',
		meaning: 'Slab thickness of a court gallery',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	railingHeightM: {
		value: 1.05,
		unit: 'm',
		meaning: 'Height of the gallery and stair railing',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	railingThicknessM: {
		value: 0.08,
		unit: 'm',
		meaning: 'Thickness of the gallery railing',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	stairRiserM: {
		value: 0.25,
		unit: 'm',
		meaning: 'Rise of one court stair step',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	courtStairWidthM: {
		value: 1.3,
		unit: 'm',
		meaning: 'Width of the court stair',
		bounds: { exclusiveMin: 0 },
		principle: 'COLOR-3'
	},
	plotThicknessM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Thickness of the ground plate of every fine cell, below the parcel ground',
		bounds: { exclusiveMin: 0 },
		principle: 'GRID-7'
	},
	courtRaiseM: {
		value: 0.06,
		unit: 'm',
		meaning: 'Height of the court ground plate above the parcel ground',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-1'
	}
});

/** Numeric settings of the house-and-court rule and its skin. */
export const settings = joinSettings(occupancy, town, skin, memphis, archigram, organic, shapes);

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
