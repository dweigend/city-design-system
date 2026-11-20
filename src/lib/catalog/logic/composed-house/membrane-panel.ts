import {
	clothIntervals as subdivisions,
	clothOpening,
	hangingCloth,
	tensionNet,
	clothColumns,
	simulateCloth,
	membraneResponse
} from '../membrane';
import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { stationAt } from './shell-station';
type Shell = NonNullable<HouseComposition['exterior']>;
type Fabric = NonNullable<Shell['fabric']>;

function wallCorner(shell: Shell, index: number, z: number) {
	const t = (z - shell.bottom) / (shell.top - shell.bottom);
	if (!shell.fabric) return stationAt(shell, z, index, 1, Math.sin(Math.PI * t));
	// A continuous guide through the surveyed foot, middle and crown avoids a crease at every floor.
	const middle = stationAt(shell, (shell.bottom + shell.top) / 2, index, 1, 1);
	const crown = shell.stations[shell.stations.length - 1].ring[index];
	const guide = shell.ring[index].map(
		(v, k) => (1 - t) ** 2 * v + 2 * t * (1 - t) * middle[k] + t * t * crown[k]
	);
	const support = stationAt(shell, z, index, 1, Math.sin(Math.PI * t));
	const foot = shell.ring[index];
	const distance = (p: number[]) => Math.hypot(p[0] - foot[0], p[1] - foot[1]);
	return distance(guide) < distance(support) ? guide : support;
}

function sample(shell: Shell, index: number, u: number, z: number) {
	const next = (index + 1) % shell.ring.length;
	const a = wallCorner(shell, index, z),
		b = wallCorner(shell, next, z);
	const rest = a.map((x, k) => x + (b[k] - x) * u);
	// Pressure acts normal to the free wall. Intersect that ray with the surveyed anchor edge.
	const left = shell.ring[index],
		right = shell.ring[next];
	const ex = right[0] - left[0],
		ey = right[1] - left[1];
	const nx = b[1] - a[1],
		ny = a[0] - b[0];
	const determinant = nx * ey - ny * ex;
	if (Math.abs(determinant) < 1e-10) return { rest, delta: [0, 0], clearance: 0 };
	const t = ((left[0] - rest[0]) * ny - (left[1] - rest[1]) * nx) / determinant;
	const ray = Math.max(0, Math.min(1, t));
	const delta = [left[0] + ray * ex - rest[0], left[1] + ray * ey - rest[1]];
	return { rest, delta, clearance: Math.hypot(...delta) };
}
function courses(shell: Shell, restraint: Fabric['restraint']) {
	if (shell.system === 'inflated-cushion' && restraint === 'net') return [shell.bottom, shell.top];
	const stride = restraint === 'straps' ? 3 : restraint === 'net' ? 2 : 1;
	return shell.stations
		.filter((_, i, all) => i % stride === 0 || i === all.length - 1)
		.map((s) => s.z);
}
type SurfaceAt = (u: number, z: number) => ReturnType<typeof sample>;
function loadedPoint(
	at: SurfaceAt,
	fabric: Fabric,
	width: number,
	u: number,
	v: number,
	low: number,
	high: number,
	displacement: number
): Vec3 {
	const span = high - low;
	const z = low + span * v;
	const { rest, delta, clearance } = at(u, z);
	const { fraction: share, sag } = membraneResponse(
		fabric,
		width,
		span,
		u,
		v,
		clearance,
		displacement
	);
	return [rest[0] + share * delta[0], rest[1] + share * delta[1], z - sag];
}
function clothFaces(cols: number, rows: number) {
	const triangles: number[] = [];
	for (let j = 0; j < rows; j++)
		for (let i = 0; i < cols; i++) {
			// A vertical slit between paired welds exposes the occupied glazing behind the membrane.
			if (clothOpening(i, j)) continue;
			const a = j * (cols + 1) + i,
				b = a + cols + 1;
			triangles.push(a, a + 1, b + 1, a, b + 1, b);
		}
	return triangles;
}
/** Spans a surveyed wall with pressurised cloth between its corner seams, ribs and selected floors. */
export function membranePanel(
	shell: Shell,
	index: number,
	start: number,
	end: number,
	fabric: Fabric
) {
	const a = shell.ring[index],
		b = shell.ring[(index + 1) % shell.ring.length];
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]) * (end - start);
	return clothMesh(shell, fabric, width, (u, z) =>
		sample(shell, index, start + (end - start) * u, z)
	);
}

/** Spans a courtyard bay between the inner survey line and its adjoining occupied cell. */
export function courtyardPanel(shell: Shell, wall: Shell['courtWalls'][number], fabric: Fabric) {
	const { a, b, centre } = wall;
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
	return clothMesh(shell, fabric, width, (u, z) => {
		const edge = a.map((v, k) => v + (b[k] - v) * u);
		const recess =
			0.45 *
			Math.sin(Math.PI * u) *
			Math.sin((Math.PI * (z - shell.bottom)) / (shell.top - shell.bottom));
		const delta = edge.map((v, k) => (v - centre[k]) * recess);
		return { rest: edge.map((v, k) => v - delta[k]), delta, clearance: Math.hypot(...delta) };
	});
}
function mapClothPoint(
	shell: Shell,
	width: number,
	at: SurfaceAt,
	[x, rise, depth]: readonly number[]
): Vec3 {
	const z = shell.bottom + Math.max(0, Math.min(shell.top - shell.bottom, rise));
	const u = Math.max(0, Math.min(1, x / width));
	const v = (z - shell.bottom) / (shell.top - shell.bottom);
	const { rest, delta, clearance } = at(u, z);
	// Reserve space behind the surveyed boundary for folds on either side of the attachment plane.
	const seam = shell.system === 'tensile-sail' ? 1 : Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
	const share = clearance > 1e-8 ? seam * (0.5 + 0.5 * Math.tanh((2 * depth) / clearance)) : 0;
	return [rest[0] + share * delta[0], rest[1] + share * delta[1], z];
}
/** The two upper load paths originate at the actual fixed vertices of the solved sail. */
export function upperSailGrips(
	shell: Shell,
	index: number,
	start: number,
	end: number,
	fabric: Fabric
) {
	const a = shell.ring[index],
		b = shell.ring[(index + 1) % shell.ring.length];
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]) * (end - start);
	const sheet = tensionNet(width, shell.top - shell.bottom, fabric);
	const at: SurfaceAt = (u, z) => sample(shell, index, start + (end - start) * u, z);
	return sheet.upperGrips.map((point) => mapClothPoint(shell, width, at, point));
}

function clothMesh(shell: Shell, fabric: Fabric, width: number, at: SurfaceAt) {
	if (shell.system === 'suspended-curtain' || shell.system === 'tensile-sail') {
		const sheet = hangingCloth(shell.system, width, shell.top - shell.bottom, fabric);
		return {
			points: sheet.positions.map((p) => mapClothPoint(shell, width, at, p)),
			triangles: sheet.faces
		};
	}
	const cols = clothColumns(width, fabric.restraint);
	const anchors = courses(shell, fabric.restraint);
	const rows = (anchors.length - 1) * subdivisions,
		points: Vec3[] = [];
	const cloth = anchors.slice(1).map((z, i) => simulateCloth(fabric, cols, width, z - anchors[i]));
	for (let j = 0; j <= rows; j++) {
		const course = Math.min(anchors.length - 2, Math.floor(j / subdivisions));
		const v = j / subdivisions - course;
		for (let i = 0; i <= cols; i++) {
			const local = i / cols;
			points.push(
				loadedPoint(
					at,
					fabric,
					width,
					local,
					v,
					anchors[course],
					anchors[course + 1],
					cloth[course][(j - course * subdivisions) * (cols + 1) + i]
				)
			);
		}
	}
	return { points, triangles: clothFaces(cols, rows) };
}
