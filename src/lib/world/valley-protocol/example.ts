import { VALLEY_MEASUREMENT_PROTOCOL } from './index';

/** Reads the fixed local survey window and field sampling interval in meters. */
export function example() {
	return {
		windowM: VALLEY_MEASUREMENT_PROTOCOL.localWindowM,
		spacingM: VALLEY_MEASUREMENT_PROTOCOL.fieldSpacingM
	};
}
