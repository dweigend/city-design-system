import { box, type Primitive } from './types';
export type SceneStyle = {
	level: 'detail' | 'block' | 'hull';
	lines: boolean;
	material: 'flat' | 'texture' | 'hatch';
	existing: boolean;
	memphis?: boolean;
	/** Material system (data/material.ts): opacity, finish, milkiness, diffusion per material. */
	materials?: boolean;
};
export const defaultStyle: SceneStyle = {
	level: 'detail',
	lines: true,
	material: 'flat',
	existing: false,
	memphis: false
};
/** Each building retains its role. Story heights survive envelope simplification. */
export function stylize(primitives: Primitive[], style: SceneStyle): Primitive[] {
	const model = primitives.map((p) => (style.existing ? { ...p, role: 'bestand' as const } : p));
	if (style.level === 'detail') return model;
	const existing = model.filter((p) => p.id.startsWith('existing-'));
	const parts = model.filter((p) => p.kind === 'box' && p.role !== 'bestand');
	// "Everything as existing stock" changes the role, never the geometry grouping.
	const source = style.existing
		? model.filter(
				(p) => p.kind === 'box' && !primitives.find((q) => q.id === p.id && q.role === 'bestand')
			)
		: parts;
	if (!source.length) return existing;
	const lo = [Infinity, Infinity, Infinity],
		hi = [-Infinity, -Infinity, -Infinity];
	for (const p of source)
		if (p.kind === 'box')
			for (let i = 0; i < 3; i++) {
				lo[i] = Math.min(lo[i], p.position[i]);
				hi[i] = Math.max(hi[i], p.position[i] + p.size[i]);
			}
	const floors = model
		.filter((p) => p.id.startsWith('deck-') && p.kind === 'box')
		.map((p) => (p.kind === 'box' ? p.position[2] : 0));
	return [
		...existing.map((p) => ({ ...p, floors: [4, 8, 12, 16] })),
		{
			...box(
				'envelope',
				[lo[0], lo[1], lo[2]],
				[hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
				'--paper',
				style.existing ? 'bestand' : 'neu'
			),
			floors
		}
	];
}
