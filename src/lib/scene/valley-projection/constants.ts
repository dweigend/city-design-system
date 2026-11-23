/** Water union bucket size in meters, limiting each polygon's overlap candidates. */
export const waterUnionBucketM = 150;
/** Minimum water fragment area in square meters, discarding floating-point slivers. */
export const waterUnionAreaEpsilonM2 = 1e-8;
/** Seam matching tolerance in meters, absorbing roundoff at shared water edges. */
export const waterSeamToleranceM = 1e-7;
