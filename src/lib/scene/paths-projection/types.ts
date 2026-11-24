import type { Vec2 } from '../../core/geometry';
import type { Footprint } from '../../core/object';

/** World-to-local transform and metric footprint supplied by the scene that hosts the paths. */
export type PathsFrame = Readonly<{
	toLocal: (x: number, y: number) => Vec2;
	footprint: Footprint;
}>;

/** How a movement kind should be drawn. */
export type MovementDrawing = 'trace' | 'bridge' | 'deck' | 'stairs';
