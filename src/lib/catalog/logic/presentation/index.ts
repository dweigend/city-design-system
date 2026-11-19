import type { LevelId } from '../../data/focus';
import { look } from '../ansicht/fokus';
import type { Primitive } from '../parametrik/types';

/** The four bible geometry levels plus omission. Pencil uses the existing-stock block. */
const geometry = {
	full: 'detail',
	silhouette: 'mid',
	pencil: 'block',
	transparent: 'hull',
	hidden: null
} as const satisfies Record<string, LevelId | null>;
export type Representation = keyof typeof geometry;
type Subsystem = 'houses' | 'stock' | 'rail' | 'paths' | 'forest' | 'terrain';
export type Focus = Readonly<Record<Subsystem, Representation>>;
const all = {
	houses: 'full',
	stock: 'pencil',
	rail: 'full',
	paths: 'full',
	forest: 'full',
	terrain: 'full'
} as const;
export const focuses = {
	all,
	infrastructure: { ...all, houses: 'pencil', forest: 'transparent', terrain: 'transparent' },
	green: { ...all, houses: 'pencil', rail: 'transparent', paths: 'transparent' },
	buildings: {
		...all,
		rail: 'transparent',
		forest: 'silhouette',
		paths: 'transparent',
		terrain: 'pencil'
	},
	people: { ...all, houses: 'pencil', forest: 'silhouette', terrain: 'pencil' }
} as const satisfies Record<string, Focus>;
export type FocusId = keyof typeof focuses;

/** Resolves the subsystem view, including the infrastructure focus override for historic rail. */
export function levelFor(
	focus: FocusId,
	system: Subsystem,
	built: number,
	year: number
): Representation {
	if (built < year && !(system === 'rail' && focus === 'infrastructure'))
		return focuses[focus].stock;
	return focuses[focus][system];
}

/** The primary volume of an open frame or coil at mid distance. */
function massOf(part: Primitive): Primitive {
	if (part.kind === 'frame') return { ...part, kind: 'box' };
	if (part.kind === 'helix') return { ...part, kind: 'cylinder' };
	return part;
}

/** Projects detached primitives into one representation using the bible focus material rules. */
export function present(parts: Primitive[], level: Representation): Primitive[] {
	const lod = geometry[level];
	if (!lod) return [];
	if (lod === 'detail') return parts;
	const visible = parts.filter(
		(p) => !p.detail || (level === 'pencil' && (p.role === 'bestand' || p.role === 'traeger'))
	);
	const mass = level === 'pencil' ? visible : visible.map(massOf);
	if (lod === 'mid') return mass;
	return mass.map((p) => {
		const styled = look(p, lod === 'block' ? 'context' : 'background') ?? p;
		return {
			...styled,
			role: 'bestand',
			envelope: undefined,
			member: undefined,
			bearings: undefined,
			token: '--paper',
			glass: false,
			edges: level === 'pencil' && p.role === 'neu' && p.edges === false ? true : p.edges,
			shade: 0,
			material: lod === 'block' ? 'paper' : 'ghost'
		};
	});
}
