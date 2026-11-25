import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	walkwayLevelOffsets: {
		value: [-1, 0, 1],
		unit: 'levels',
		meaning: 'Walkway levels relative to the local eaves plane',
		principle: 'CITY-4'
	},
	walkwayRoofClearanceM: {
		value: 1,
		unit: 'm',
		meaning: 'Minimum underside allowance over the incident roof envelopes',
		rationale: 'Keep the whole deck above the taller column'
	},
	walkwaySideClearanceM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Lateral clearance around the pedestrian centerline',
		rationale: 'Cover half the walkway ribbon and its widened corners'
	},
	walkwayCatchmentM: {
		value: 240,
		unit: 'm',
		meaning: 'Extent of walkway branches from caller-selected anchors',
		rationale: 'One visible quarter around the crossing'
	},
	groundTraceStepM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum terrain sampling interval along reserved lanes',
		rationale: 'Follow the same ground as the plan'
	},
	preferredLaneCostRatio: {
		value: 0.8,
		unit: 'm/m',
		meaning: 'Cost per meter along a main lane or promenade relative to a local lane',
		rationale: 'Prefer the designated through routes on otherwise comparable walks',
		bounds: { exclusiveMin: 0, max: 1 }
	},
	stairCostRatio: {
		value: 4,
		unit: 'm/m',
		meaning: 'Cost per meter of stair travel',
		rationale: 'Include the inconvenience of switching levels'
	},
	stairFlightRiseM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Maximum rise along one flight of a switchback',
		rationale: 'Use half a nominal lattice level'
	},
	stairRunRatio: {
		value: 1.65,
		unit: 'm/m',
		meaning: 'Horizontal run per meter of stair rise',
		rationale: 'Allow walkable treads'
	},
	stairFlightSeparationM: {
		value: 1.8,
		unit: 'm',
		meaning: 'Distance between the two flight axes of a switchback',
		rationale: 'Leave space between flights'
	},
	stairFootprintProbeStepM: {
		value: 1,
		unit: 'm',
		meaning: 'Maximum spacing of dry-ground probes over a stair footprint',
		rationale: 'Resolve small changes in bank position'
	},
	stairBearingCount: {
		value: 32,
		unit: 'directions',
		meaning: 'Number of stair orientations tested around a node',
		rationale: 'Sample acute corners while retaining stable order'
	},
	railTerrainSlopeBoundRatio: {
		value: 2,
		unit: 'm/m',
		meaning: 'Grade allowance used by the valley rail demo terrain envelope',
		rationale: 'Reserve clearance between the span probes on the regional terrain'
	},
	railHalfLengthM: {
		value: 4000,
		unit: 'm',
		meaning: 'Half-length of the regional rail demonstration',
		rationale: 'Cover the valley measurement reach'
	},
	railCorridorStepM: {
		value: 60,
		unit: 'm',
		meaning: 'Spacing of parallel rail corridors',
		principle: 'CITY-4'
	},
	railCorridorCount: {
		value: 14,
		unit: 'corridors/side',
		meaning: 'Parallel rail candidates surveyed on either side of town',
		rationale: 'Compare nearby routes across both terraces'
	},
	railDockReachM: {
		value: 180,
		unit: 'm',
		meaning: 'Maximum horizontal reach of a station dock',
		rationale: 'Constrain the demonstration to local connections'
	},
	railCatchmentSpacingM: {
		value: 700,
		unit: 'm',
		meaning: 'Along-valley spacing between catchment centers',
		rationale: 'Two town station catchments at walking distance'
	},
	railCatchmentHalfWidthM: {
		value: 250,
		unit: 'm',
		meaning: 'Along-valley half-length of each station catchment',
		rationale: 'Keep docking areas disjoint'
	}
});

export const defaults = settingValues(settings);
