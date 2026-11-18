/**
 * View tags: from id, role, color and position every primitive receives its group
 * (module + level), its flow, its layer and its build phase. The views read only these
 * tags, never the internals of a scene: so the same layer serves corner modules and world.
 */
import { flowToken, type FlowId } from '../../data/focus';
import type { ColorToken, Primitive } from '../parametrik/types';
import { bounds } from './geometrie';

/** Floor height in meters (eckraster HEIGHT_STEP). */
export const STOREY = 4;

export type Schicht =
	'boden' | 'bestand' | 'geruest' | 'struktur' | 'modul' | 'netz' | 'kopf' | 'gruen';
export const schichten: Schicht[] = [
	'boden',
	'bestand',
	'geruest',
	'struktur',
	'modul',
	'netz',
	'kopf',
	'gruen'
];

export type Tag = {
	id: string;
	/** Module (stable id without part number), e.g. corner slot, stair, crown. */
	module: string;
	/** Floor: from the id (@n) or from the bottom edge. */
	level: number;
	/** Group for explosion and selection: module@level#phase. */
	group: string;
	flow: FlowId | null;
	schicht: Schicht;
	/** Build phase after 134: 0 existing stock, 1 frame, 2 core, 3 plug-in modules and networks, 4 crown. */
	phase: number;
	line: boolean;
};

const flowOf = new Map<ColorToken, FlowId>(
	(Object.entries(flowToken) as [FlowId, ColorToken][]).map(([f, t]) => [t, f])
);
export const flowOfToken = (t: ColorToken): FlowId | null => flowOf.get(t) ?? null;

/** Source id: derived parts (section, caps) append their identifier after #. */
export const quelle = (id: string) => id.split('#')[0];

/** Module from the id: before @, else up to the first cell reference (contains /), else two segments. */
export function moduleOf(id: string): string {
	const base = quelle(id);
	if (base.includes('@')) return base.split('@')[0];
	const parts = base.split(':');
	const cell = parts.findIndex((s) => s.includes('/'));
	return parts.slice(0, cell >= 0 ? cell + 1 : Math.min(2, parts.length)).join(':');
}

export function schichtOf(p: Primitive, flow: FlowId | null): Schicht {
	const id = quelle(p.id);
	if (id === 'ground' || id.startsWith('untergrund')) return 'boden';
	if (p.role === 'bestand') return 'bestand';
	if (p.role === 'traeger' || p.token === '--signal' || id.includes('geruest')) return 'geruest';
	if (id.startsWith('treppe') || id.startsWith('netz') || p.kind === 'pipe') return 'netz';
	if (id.startsWith('kopf')) return 'kopf';
	if (id.startsWith('garden')) return 'gruen';
	return flow ? 'modul' : 'struktur';
}

const phaseOf: Record<Schicht, number> = {
	boden: 0,
	bestand: 0,
	geruest: 1,
	struktur: 2,
	modul: 3,
	netz: 3,
	kopf: 4,
	gruen: 4
};

export function tag(p: Primitive): Tag {
	const id = quelle(p.id);
	const at = /@(-?\d+)/.exec(id);
	const level = at ? Number(at[1]) : Math.floor((bounds(p).min[2] + 0.2) / STOREY);
	const flow = p.token === '--paper' ? null : flowOfToken(p.token);
	const line = p.kind === 'polyline';
	// Only new contour polylines bypass the role and geometry classification.
	const schicht =
		line && p.role === 'neu' && !id.startsWith('treppe') ? 'struktur' : schichtOf(p, flow);
	const phase = phaseOf[schicht];
	const module = moduleOf(id);
	return { id, module, level, group: `${module}@${level}#${phase}`, flow, schicht, phase, line };
}

export type Tags = Map<string, Tag>;
export const tagAll = (primitives: Primitive[]): Tags =>
	new Map(primitives.map((p) => [quelle(p.id), tag(p)]));

/** Tag of a primitive (derived ones too); unknown ids get their own. */
export const tagFor = (tags: Tags, p: Primitive): Tag => tags.get(quelle(p.id)) ?? tag(p);
