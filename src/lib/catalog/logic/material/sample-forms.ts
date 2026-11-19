import type { Primitive } from '../parametrik/types';
const base = { role: 'neu', token: '--cat-nature', material: 'wood', edges: false } as const;
const origin = [0, 0, 2] as const;
export const forms = {
	box: { ...base, id: 'box', kind: 'box', position: [...origin], size: [2, 2, 2] },
	prism: {
		...base,
		id: 'prism',
		kind: 'prism',
		polygon: [
			[0, 0],
			[2, 0],
			[0, 2]
		],
		z: 2,
		height: 2
	},
	wedge: { ...base, id: 'wedge', kind: 'wedge', position: [...origin], size: [2, 2, 2] },
	cylinder: {
		...base,
		id: 'cylinder',
		kind: 'cylinder',
		position: [...origin],
		radius: 1,
		height: 2
	},
	cone: { ...base, id: 'cone', kind: 'cone', position: [...origin], radius: 1, height: 2 },
	sphere: { ...base, id: 'sphere', kind: 'sphere', position: [...origin], radius: 1 },
	dome: { ...base, id: 'dome', kind: 'dome', position: [...origin], radius: 1 },
	ring: {
		...base,
		id: 'ring',
		kind: 'ring',
		position: [...origin],
		radius: 1,
		innerRadius: 0.5,
		depth: 0.2
	},
	torus: { ...base, id: 'torus', kind: 'torus', position: [...origin], radius: 1, tube: 0.2 },
	capsule: {
		...base,
		id: 'capsule',
		kind: 'capsule',
		from: [...origin],
		to: [0, 2, 2],
		radius: 0.5
	},
	pipe: { ...base, id: 'pipe', kind: 'pipe', points: [[...origin], [0, 2, 2]], radius: 0.3 },
	mesh: {
		...base,
		id: 'mesh',
		kind: 'mesh',
		points: [
			[0, 0, 0],
			[2, 0, 0],
			[0, 2, 2]
		],
		triangles: [0, 1, 2],
		lines: [[0, 1, 2, 0]]
	},
	polyline: { ...base, id: 'polyline', kind: 'polyline', points: [[...origin], [0, 2, 2]] },
	arch: { ...base, id: 'arch', kind: 'arch', position: [...origin], width: 2, length: 2, rise: 1 },
	vault: {
		...base,
		id: 'vault',
		kind: 'vault',
		position: [...origin],
		width: 2,
		length: 2,
		rise: 1
	},
	halfpipe: {
		...base,
		id: 'halfpipe',
		kind: 'halfpipe',
		position: [...origin],
		width: 2,
		length: 2,
		rise: 1
	},
	frame: {
		...base,
		id: 'frame',
		kind: 'frame',
		position: [...origin],
		size: [2, 2, 2],
		cells: [1, 1, 1],
		bar: 0.1
	},
	helix: {
		...base,
		id: 'helix',
		kind: 'helix',
		position: [...origin],
		radius: 1,
		innerRadius: 0.2,
		height: 3,
		turns: 1,
		thickness: 0.2
	},
	membrane: {
		...base,
		id: 'membrane',
		kind: 'membrane',
		corners: [[...origin], [2, 0, 2], [2, 2, 3], [0, 2, 2]]
	}
} satisfies Record<Primitive['kind'], Primitive>;
