/** Clips and measures polylines supplied in meters. */
export { clipPolylineToSquare, sinuosity, type ClippedReach } from '../../core/polyline';
/** Measures channel length, valley length, sinuosity and wavelength from plain course data. */
export { measureRiver, type RiverGeometry } from './reach';
/** Measures widths, relief, slopes and terrace steps from an independent elevation raster. */
export { measureRiverSurface, type SurfaceProtocol } from './surface-metrics';
/** A centered north-first grid of independent terrain observations. */
export type { SurfaceGrid } from './surface-grid';
