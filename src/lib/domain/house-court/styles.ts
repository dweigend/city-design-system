import { defaults as d } from '../../../config/house-court';

/** How a built cell run is filled: the merged envelope of all cells, an inset block, a round
 * or chamfered primitive, a soft pod, or framed storeys holding capsules. */
export type FillKind = 'envelope' | 'block' | 'round' | 'chamfer' | 'pod' | 'capsule';
/** Solid set on top of a run, inside the storey above it in the same cell. */
export type RoofKind = 'flat' | 'wedge' | 'cone' | 'dome';
/** Figure of an opening in a wall. */
export type OpeningKind = 'rect' | 'round' | 'triangle';

/** A style is a parameter set of the one house rule (FORM-10): occupancy tendencies, how a cell
 * is filled, roofs, openings, which part kinds appear, and the role slots its parts carry. Lists
 * are drawn from per cell with a keyed seed. Any record of this shape is a valid style. */
export type HouseStyle = Readonly<{
	id: string;
	occupancy: Readonly<{
		rearDropRatio: number;
		courtStepComplexityRatio: number;
		courtStepStoreys: number;
		jitterComplexityRatio: number;
		jitterShareRatio: number;
		jitterStoreys: number;
		groundOpenRatio: number;
	}>;
	fill: Readonly<{
		kinds: readonly FillKind[];
		insetM: number;
		roundShareRatio: number;
		stackShareRatio: number;
		stackInsetM: number;
		capsuleShareRatio: number;
		capsuleGapM: number;
	}>;
	roof: Readonly<{ kinds: readonly RoofKind[]; riseRatio: number }>;
	opening: Readonly<{ kinds: readonly OpeningKind[]; pitchM: number; sizeM: number; collar: boolean }>;
	parts: Readonly<{
		edges: boolean;
		galleries: boolean;
		stair: boolean;
		frame: boolean;
		braceShareRatio: number;
		tubeShareRatio: number;
		mastStoreys: number;
		planters: boolean;
		patternShareRatio: number;
		treeShareRatio: number;
	}>;
	slots: Readonly<{ body: readonly string[]; roof: readonly string[]; capsule: readonly string[] }>;
}>;

const none = { braceShareRatio: 0, tubeShareRatio: 0, mastStoreys: 0, patternShareRatio: 0, treeShareRatio: 0 };
const neutralOccupancy = {
	rearDropRatio: d.rearDropRatio,
	courtStepComplexityRatio: d.courtStepComplexityRatio,
	courtStepStoreys: d.courtStepStoreys,
	jitterComplexityRatio: d.jitterComplexityRatio,
	jitterShareRatio: d.jitterShareRatio,
	jitterStoreys: 1,
	groundOpenRatio: 0
};
const solidFill = { insetM: 0, roundShareRatio: 0, stackShareRatio: 0, stackInsetM: 0, capsuleShareRatio: 0, capsuleGapM: 0 };

/** The style rows of the chapter. `neutral` is the R11 house: one merged envelope with floor
 * edges, roof edges, window rows, galleries and a stair. */
export const houseStyles = Object.freeze({
	neutral: {
		id: 'neutral',
		occupancy: neutralOccupancy,
		fill: { ...solidFill, kinds: ['envelope'] },
		roof: { kinds: ['flat'], riseRatio: 0 },
		opening: { kinds: ['rect'], pitchM: d.windowPitchM, sizeM: d.windowWidthM, collar: false },
		parts: { ...none, edges: true, galleries: true, stair: true, frame: false, planters: false },
		slots: { body: ['wall'], roof: [], capsule: [] }
	},
	memphis: {
		id: 'memphis',
		occupancy: { ...neutralOccupancy, rearDropRatio: d.memphisRearDropRatio, courtStepStoreys: 0, jitterComplexityRatio: 0, jitterShareRatio: d.memphisJitterShareRatio, jitterStoreys: d.memphisJitterStoreys },
		fill: { ...solidFill, kinds: ['block', 'round', 'block', 'chamfer'], insetM: d.memphisInsetM, roundShareRatio: d.roundBlockShareRatio, stackShareRatio: d.memphisStackShareRatio, stackInsetM: d.memphisStackInsetM },
		roof: { kinds: ['flat', 'wedge', 'cone', 'dome', 'flat'], riseRatio: d.memphisRoofRiseRatio },
		opening: { kinds: ['round', 'triangle'], pitchM: d.memphisOpeningPitchM, sizeM: d.memphisOpeningSizeM, collar: true },
		parts: { ...none, edges: false, galleries: false, stair: true, frame: false, planters: false, patternShareRatio: d.memphisPatternShareRatio },
		slots: { body: ['body-white', 'body-yellow', 'body-blue', 'body-timber', 'body-red', 'body-white'], roof: ['roof-blue', 'roof-yellow', 'roof-red'], capsule: [] }
	},
	archigram: {
		id: 'archigram',
		occupancy: { ...neutralOccupancy, rearDropRatio: 0, courtStepStoreys: 0, jitterComplexityRatio: 0, jitterShareRatio: d.archigramJitterShareRatio, groundOpenRatio: d.archigramGroundOpenRatio },
		fill: { ...solidFill, kinds: ['capsule'], insetM: d.archigramCapsuleInsetM, roundShareRatio: d.organicRoundShareRatio, capsuleShareRatio: d.archigramCapsuleShareRatio, capsuleGapM: d.archigramCapsuleGapM },
		roof: { kinds: ['flat'], riseRatio: 0 },
		opening: { kinds: ['round'], pitchM: d.archigramOpeningPitchM, sizeM: d.archigramOpeningSizeM, collar: false },
		parts: { ...none, edges: false, galleries: true, stair: true, frame: true, planters: false, braceShareRatio: d.archigramBraceShareRatio, tubeShareRatio: d.archigramTubeShareRatio, mastStoreys: d.archigramMastStoreys },
		slots: { body: [], roof: [], capsule: ['capsule', 'capsule', 'capsule-accent', 'capsule'] }
	},
	organic: {
		id: 'organic',
		occupancy: { ...neutralOccupancy, rearDropRatio: d.organicRearDropRatio, courtStepComplexityRatio: 0, jitterShareRatio: d.organicJitterShareRatio },
		fill: { ...solidFill, kinds: ['pod'], insetM: d.organicInsetM, roundShareRatio: d.organicRoundShareRatio },
		roof: { kinds: ['dome'], riseRatio: d.organicRoofRiseRatio },
		opening: { kinds: ['round'], pitchM: d.organicOpeningPitchM, sizeM: d.organicOpeningSizeM, collar: true },
		parts: { ...none, edges: false, galleries: false, stair: true, frame: false, planters: true, treeShareRatio: d.organicTreeShareRatio },
		slots: { body: ['body-shell'], roof: ['body-shell'], capsule: [] }
	}
} as const satisfies Record<string, HouseStyle>);

/** Style names in menu order. */
export type HouseStyleName = keyof typeof houseStyles;
