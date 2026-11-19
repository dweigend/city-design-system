import type { Primitive, Vec3 } from '../parametrik/types';
import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { plate, circle } from './assembly';
import { panel } from './objects/forms';
import { surface } from './parts';

type Kind = Primitive['kind'];
type Form = (span: number) => ObjectGeometry;
const body = surface();
const origin: Vec3 = [0, 0, 0];
const forms = {
	box: (s) => ({ ...body, kind: 'box', position: [-s / 2, -0.5, 0], size: [s, 1, 1] }),
	prism: (s) => ({
		...body,
		kind: 'prism',
		polygon: [
			[-s / 2, -0.5],
			[s / 2, -0.5],
			[0, 0.5]
		],
		z: 0,
		height: 1
	}),
	wedge: (s) => ({
		...body,
		kind: 'wedge',
		position: [-s / 2, -0.5, 0],
		size: [s, 1, 1],
		low: 0.1
	}),
	cylinder: (s) => ({ ...body, kind: 'cylinder', position: origin, radius: 0.5, height: s }),
	cone: (s) => ({ ...body, kind: 'cone', position: origin, radius: 0.5, height: s }),
	sphere: (s) => ({ ...body, kind: 'sphere', position: [0, 0, s / 2], radius: 0.5, squash: s }),
	dome: (s) => ({ ...body, kind: 'dome', position: origin, radius: 0.5, height: s / 2 }),
	ring: (s) => ({
		...body,
		kind: 'ring',
		position: [0, 0, 0.5],
		radius: 0.5,
		innerRadius: 0.32,
		depth: s / 3
	}),
	torus: (s) => ({
		...body,
		kind: 'torus',
		axis: 'z',
		position: [0, 0, 0.08],
		radius: s / 2,
		tube: 0.08
	}),
	capsule: (s) => ({
		...body,
		kind: 'capsule',
		from: [-s / 2, 0, 0.25],
		to: [s / 2, 0, 0.25],
		radius: 0.25
	}),
	pipe: (s) => ({
		...body,
		kind: 'pipe',
		points: [
			[-s / 2, 0, 0.08],
			[s / 2, 0, 0.08]
		],
		radius: 0.08
	}),
	mesh: (s) => ({
		...body,
		kind: 'mesh',
		points: [
			[-s / 2, -0.5, 0],
			[s / 2, -0.5, 0],
			[0, 0.5, 0.5]
		],
		triangles: [0, 1, 2],
		lines: [[0, 1, 2, 0]]
	}),
	// Sweep the piecewise line into a 25 mm stroke so its finish has a visible surface.
	polyline: (s) => ({
		...body,
		kind: 'pipe',
		radius: 0.0125,
		points: [
			[-s / 2, 0, 0.025],
			[0, 0, 0.5],
			[s / 2, 0.2, 0.5]
		]
	}),
	arch: (s) => ({
		...body,
		kind: 'arch',
		position: origin,
		width: s,
		length: 0.75,
		rise: 1,
		thickness: 0.1
	}),
	vault: (s) => ({
		...body,
		kind: 'vault',
		position: origin,
		width: s,
		length: 0.75,
		rise: 0.6,
		thickness: 0.08
	}),
	halfpipe: (s) => ({
		...body,
		kind: 'halfpipe',
		position: origin,
		width: s,
		length: 0.75,
		rise: 0.6,
		thickness: 0.08
	}),
	frame: (s) => ({
		...body,
		kind: 'frame',
		position: [-s / 2, -0.5, 0.05],
		size: [s, 1, 1],
		cells: [2, 1, 1],
		bar: 0.06
	}),
	helix: (s) => ({
		...body,
		kind: 'helix',
		position: [0, 0, 0.1],
		radius: 0.7,
		innerRadius: 0.4,
		height: s,
		turns: 1,
		thickness: 0.08
	}),
	membrane: (s) => ({
		...body,
		kind: 'membrane',
		corners: [
			[-s / 2, -0.5, 0.4],
			[s / 2, -0.5, 0.7],
			[s / 2, 0.5, 0.4],
			[-s / 2, 0.5, 0.7]
		],
		sag: 0.15
	})
} satisfies Record<Kind, Form>;

export const primitiveObjects: AssetRecipe[] = Object.entries(forms).map(([kind, draw]) => ({
	id: 'primitive-' + kind,
	category: 'primitive-forms',
	variants: ['short', 'medium', 'long'],
	footprint: [2.6, 2.6],
	slotNames: ['body'],
	anchors: [mount('deck')],
	draw: (variant) => [structuredClone(draw(1 + 0.5 * variant))]
}));

const square: [number, number][] = [
	[-0.5, -0.5],
	[0.5, -0.5],
	[0.5, 0.5],
	[-0.5, 0.5]
];
// A unit bearing plate for surveyed decks, landings and mitered walkway treads.
primitiveObjects.push({
	id: 'primitive-slab',
	category: 'primitive-forms',
	variants: ['square', 'rounded', 'round'],
	footprint: [1, 1],
	slotNames: ['body'],
	anchors: [mount('deck')],
	draw(variant) {
		const outline =
			variant === 1
				? panel(0, 0, 0, 1, 1, 1, 'body')
				: plate(variant === 2 ? circle(0.5, 20) : structuredClone(square), 0, 1);
		if (outline.kind !== 'prism') throw new Error('Expected a bearing plate');
		return [{ ...outline, bearing: 'slab' }];
	}
});
