/**
 * Contract between grids (procedural systems) and forms (form vocabulary).
 * Specification: docs/research/70-vokabular.md. Types only, no logic.
 *
 * Grids return cells. Forms fill a cell (footprint) with primitives.
 * Both are pure, deterministic functions of parameters and seed.
 */
import type { ColorToken, MaterialId, Primitive, Role } from './types';

export type Point2 = [number, number];

/* ── Raster ─────────────────────────────────────────────── */

export type GridKind =
	| 'square'
	| 'axis'
	| 'triangle'
	| 'hex'
	| 'quad-irregular'
	| 'voronoi'
	| 'polar'
	| 'contour'
	| 'vertical';

/** Eine Rasterzelle in Metern (x/y Grundebene). */
export type Cell = {
	id: string;
	/** Counterclockwise, closed without repeating the first point. */
	polygon: Point2[];
	center: Point2;
	area: number;
	/** Direction of the dominant edge in radians: local orientation for forms. */
	orientation: number;
	neighbors: string[];
	/** Floor or height level (vertical grids); otherwise 0. */
	level: number;
	/** Free values set by a field/attractor (0–1), e.g. dichte, naehe. */
	fields?: Record<string, number>;
	/** Existing stock or open space. */
	role?: Role;
};

export type Grid = {
	kind: GridKind;
	cells: Cell[];
	/** Edges between cell centers (path/connection graph). */
	links: [string, string][];
	bounds: { min: Point2; max: Point2 };
};

export type ParamSpec = {
	key: string;
	label: string;
	min: number;
	max: number;
	step: number;
	default: number;
};

export type GridGenerator = {
	kind: GridKind;
	name: string;
	params: ParamSpec[];
	generate: (params: Record<string, number>, seed: number) => Grid;
};

/* ── Formen ─────────────────────────────────────────────── */

export type FormGroup =
	| 'klotz'
	| 'zylinder'
	| 'kapsel'
	| 'bogen'
	| 'rahmen'
	| 'ring'
	| 'rohr'
	| 'kopf'
	| 'huelle'
	| 'erschliessung'
	| 'vegetation'
	| 'bestand';

/** What a form receives for generation. */
export type FormContext = {
	/** Footprint, usually a grid cell. */
	footprint: Point2[];
	center: Point2;
	orientation: number;
	/** Unterkante in Metern. */
	z: number;
	/** Available height in meters (upper bound). */
	height: number;
	role: Role;
	seed: number;
	token?: ColorToken;
	material?: MaterialId;
};

export type FormFamily = {
	id: string;
	name: string;
	group: FormGroup;
	/** Archive numbers of the references the form comes from. */
	refs: string[];
	params: ParamSpec[];
	generate: (ctx: FormContext, params: Record<string, number>) => Primitive[];
};

/* ── Komposition ────────────────────────────────────────── */

/** A rule assigns forms to cells (grammar on the grid). */
export type CompositionRule = {
	id: string;
	name: string;
	refs: string[];
	/** Chooses a form ID and its parameters for a cell, or null for empty. */
	pick: (
		cell: Cell,
		grid: Grid,
		seed: number
	) => { form: string; params?: Record<string, number> } | null;
};
