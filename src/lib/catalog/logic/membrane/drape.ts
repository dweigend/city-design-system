import { Body, Spring, Vec3 } from 'cannon-es';
import { tensionNet } from './saddle';
import type { Membrane } from './cloth';

type Hanging = 'tensile-sail' | 'suspended-curtain';
const intervals = 16;
const dt = 1 / 60;
type Sheet = ReturnType<typeof bake>;
const cache = new Map<string, Sheet>();

function railTie(x: number, y: number) {
	return (y === intervals && x % 4 === 0) || (y === 0 && [0, intervals].includes(x));
}

// The cloth is cut above the entrance line between ground ties. Its lower edge can hang freely.
function hem(width: number, height: number, u: number) {
	return Math.min(3.6, width * 0.25, height * 0.22) * Math.sin(Math.PI * u);
}

function particles(width: number, height: number, mass: number) {
	const nodes: Body[] = [];
	for (let j = 0; j <= intervals; j++)
		for (let i = 0; i <= intervals; i++) {
			const u = i / intervals,
				v = j / intervals;
			// Lay out fullness in the cut before hanging it. The solver can unwind these folds.
			const fold = Math.sin(6 * Math.PI * u);
			const depth = Math.min(width, height) * 0.055 * fold * Math.sin(Math.PI * v);
			const edge = i === 0 || i === intervals;
			nodes.push(
				new Body({
					mass: railTie(i, j) ? 0 : mass,
					position: new Vec3(width * u, height * v + (1 - v) * hem(width, height, u), depth),
					linearFactor: edge ? new Vec3(0, 1, 0) : new Vec3(1, 1, 1)
				})
			);
		}
	return nodes;
}

function weave(nodes: Body[], dx: number, dy: number, tension: number) {
	const springs: Spring[] = [],
		faces: number[] = [];
	const fullness = 1.09;
	function yarn(a: number, b: number, length: number, stiffness: number) {
		const start = nodes[a].position,
			end = nodes[b].position;
		const rest =
			(length * Math.hypot(end.x - start.x, end.y - start.y)) /
			Math.hypot(
				((b % (intervals + 1)) - (a % (intervals + 1))) * dx,
				(Math.floor(b / (intervals + 1)) - Math.floor(a / (intervals + 1))) * dy
			);
		const spring = new Spring(nodes[a], nodes[b], { restLength: rest, stiffness });
		spring.damping = 0;
		springs.push(spring);
	}
	for (let j = 0; j < intervals; j++)
		for (let i = 0; i < intervals; i++) {
			const a = j * (intervals + 1) + i,
				b = a + intervals + 1;
			yarn(a, a + 1, dx * fullness, (0.5 * tension * dy) / dx);
			yarn(a, b, dy * 1.015, (0.5 * tension * dx) / dy);
			yarn(b, b + 1, dx * fullness, (0.5 * tension * dy) / dx);
			yarn(a + 1, b + 1, dy * 1.015, (0.5 * tension * dx) / dy);
			const diagonal = Math.hypot(dx * fullness, dy);
			yarn(a, b + 1, diagonal, tension * 0.22);
			yarn(a + 1, b, diagonal, tension * 0.22);
			faces.push(a, a + 1, b + 1, a, b + 1, b);
		}
	return { springs, faces };
}

function loadFaces(nodes: Body[], faces: number[], pressure: number) {
	const ab = new Vec3(),
		ac = new Vec3(),
		normal = new Vec3();
	for (let i = 0; i < faces.length; i += 3) {
		const a = nodes[faces[i]],
			b = nodes[faces[i + 1]],
			c = nodes[faces[i + 2]];
		b.position.vsub(a.position, ab);
		c.position.vsub(a.position, ac);
		ab.cross(ac, normal);
		normal.scale(pressure / 6, normal);
		for (const node of [a, b, c]) node.force.vadd(normal, node.force);
	}
}

function bake(width: number, height: number, fabric: Membrane) {
	const dx = width / intervals,
		dy = height / intervals;
	const stiffness = fabric.tension * 8;
	const mass = 4 * dt ** 2 * stiffness * (dx / dy + dy / dx + 1);
	const nodes = particles(width, height, mass);
	const { springs, faces } = weave(nodes, dx, dy, stiffness);
	// This is static form finding: numerical mass and damping limit each relaxation step.
	for (let step = 0; step < 110; step++) {
		for (const yarn of springs) yarn.applyForce();
		loadFaces(nodes, faces, fabric.pressure);
		for (const node of nodes) {
			node.force.y -= 0.018 * dx * dy;
			node.velocity.scale(0.83, node.velocity);
			node.integrate(dt, false, false);
			node.force.setZero();
		}
	}
	return { positions: nodes.map(({ position: p }) => [p.x, p.y, p.z] as const), faces };
}

/** Hangs a full wall between its mast or rail attachments under gravity and face-normal pressure. */
export function hangingCloth(style: Hanging, width: number, height: number, fabric: Membrane) {
	if (style === 'tensile-sail') return tensionNet(width, height, fabric);
	const key = [style, width, height, fabric.tension, fabric.pressure].join('/');
	const previous = cache.get(key);
	if (previous) return previous;
	const sheet = bake(width, height, fabric);
	if (cache.size >= 64) cache.clear();
	cache.set(key, sheet);
	return sheet;
}
