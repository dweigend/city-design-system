import type { Patch } from '../../eckraster/topology';
import type { Grid, Point2 } from '../../vocab';
export type UniversalGrid = Omit<Grid, 'kind'> & { kind: Grid['kind'] | 'organic' };
export type Origin = {
	kind: 'corner' | 'edge' | 'center';
	cells: string[];
	edge?: [string, string];
	level: number;
	boundary: boolean;
	fixed: boolean;
};
export type PatchOptions = {
	seed?: number;
	iterations?: number;
	/** Median edge length after subdivision, meters; omit to retain input scale. */
	cellSize?: number;
	fixedCells?: ReadonlySet<string>;
	fixedVertices?: ReadonlySet<string>;
	minArea?: number;
	minAngle?: number;
};
export type UniversalPatch = Patch & {
	origins: Map<string, Origin>;
	quality: { minAngle: number; minArea: number; maxAspect: number };
};
export type StructureOptions = { blockSize?: number; density?: number; center?: Point2 };
export type Block = { id: string; cells: string[]; center: Point2; naehe: number; seed: number };
export type Structures = {
	blocks: Block[];
	blockOf: Map<string, Block>;
	parcels: { id: string; block: string; cells: string[] }[];
	alleys: Set<string>;
	squares: Set<string>;
	fields: Map<string, { naehe: number; dichte: number }>;
	orientation: Map<string, number>;
	neighbors: Map<string, string[]>;
};
