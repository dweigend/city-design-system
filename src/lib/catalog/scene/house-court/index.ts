import {
	Box3,
	Color,
	EdgesGeometry,
	Group,
	Line2NodeMaterial,
	Mesh,
	MeshBasicNodeMaterial,
	Vector3
} from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { mix, normalWorldGeometry, uniform, vec3 } from 'three/tsl';
import { STRICHE } from '../../data/leitstil';
import type { CellPoint } from '../../logic/cell-space';
import { exposedHouseFaces, type HouseCourt } from '../../logic/house-court';
import type { ParcelDeck } from '../../logic/parcel-deck';
import { required } from '../../logic/required';
import type { StageContext } from '../sandbox';
import { faceGeometry, stagePoint } from './geometry';

const PLOT_DEPTH = 0.24;
const FRAME_MARGIN = 0.5;
const ELEVATION_RAD = (40 * Math.PI) / 180;
const HEADING_OFFSET_RAD = Math.PI / 12;
const EYE_DISTANCE_SCALE = 4;

function eyeDistance(deck: ParcelDeck): number {
	const [origin, right, , back] = deck.plotRing;
	const edgeLength = (edge: CellPoint) => Math.hypot(edge[0] - origin[0], edge[1] - origin[1]);
	const plotWidth = edgeLength(right);
	const plotDepth = edgeLength(back);
	const extent = Math.max(plotWidth, plotDepth, deck.inputs.height);
	const distance = EYE_DISTANCE_SCALE * extent;
	if (!(plotWidth > 0 && plotDepth > 0 && Number.isFinite(Math.fround(distance + extent))))
		throw new RangeError(
			`Cannot frame the ${plotWidth} × ${plotDepth} m plot. Plot edges must be positive and the camera range must fit 32-bit coordinates.`
		);
	return distance;
}

function plotRings(ring: readonly CellPoint[]) {
	const lower = ring.map(([x, y, z]): CellPoint => [x, y, z - PLOT_DEPTH]);
	return [
		ring,
		[...lower].reverse(),
		...ring.map((a, i) => {
			const next = (i + 1) % ring.length;
			return [a, lower[i], lower[next], ring[next]];
		})
	];
}

function surface(inkMix: number, lightStrength = 0.08) {
	const paper = uniform(new Color());
	const ink = uniform(new Color());
	const material = new MeshBasicNodeMaterial({
		toneMapped: false,
		polygonOffset: true,
		// Keep the full screen-space edge stroke above its supporting faces.
		polygonOffsetFactor: Math.ceil(STRICHE.kontur * 2 * Math.SQRT2),
		polygonOffsetUnits: 1
	});
	const light = normalWorldGeometry.dot(vec3(-0.56, 0.76, 0.32));
	const shade = light.mul(-lightStrength).add(inkMix).clamp(0.03, 0.95);
	material.colorNode = mix(paper.rgb, ink.rgb, shade);
	return { material, paper: paper.value, ink: ink.value };
}

function meshOutlines(geometry: ReturnType<typeof faceGeometry>, material: Line2NodeMaterial) {
	const edges = new EdgesGeometry(geometry);
	const positions = Array.from(edges.getAttribute('position').array);
	const lines = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material);
	lines.renderOrder = 1;
	edges.dispose();
	return lines;
}

function houseRings(house: HouseCourt, datum: number) {
	const nodes = new Map(house.space.nodes.map(({ id, position }) => [id, position]));
	const court = new Set(house.court.cellIds);
	const courtFaces = new Set(
		house.space.faces
			.filter(({ uses }) => uses.some(({ cellId }) => court.has(cellId)))
			.map(({ id }) => id)
	);
	const roof: CellPoint[][] = [];
	const exterior: CellPoint[][] = [];
	const recess: CellPoint[][] = [];
	for (const { id, nodeIds } of exposedHouseFaces(house)) {
		const ring = nodeIds.map((node) => required(nodes.get(node), 'house face node'));
		if (courtFaces.has(id)) recess.push(ring);
		else if (ring.every((point) => point[2] > datum)) roof.push(ring);
		else exterior.push(ring);
	}
	return { roof, exterior, recess };
}

/**
 * Creates the stage context for a filled house and its level parcel, in metres.
 * Projects exposed rings only. The stage supplies the live palette and owns disposal.
 */
export function createHouseCourtContext(deck: ParcelDeck, house: HouseCourt): StageContext {
	const distance = eyeDistance(deck);
	const group = new Group();
	const origin = deck.plotRing[0];
	const { roof, exterior, recess } = houseRings(house, origin[2]);
	const ground = plotRings(deck.plotRing);
	const surfaces = [surface(0.13), surface(0.5), surface(0.83, 0), surface(0.26)];
	const meshes = [roof, exterior, recess, ground].map(
		(rings, i) => new Mesh(faceGeometry(rings, origin), surfaces[i].material)
	);
	group.add(...meshes);
	const bounds = new Box3().setFromObject(group).expandByScalar(FRAME_MARGIN);
	const lineMaterial = new Line2NodeMaterial({
		linewidth: STRICHE.kontur,
		depthWrite: false,
		toneMapped: false
	});
	const shell = faceGeometry([...roof, ...exterior, ...recess], origin);
	const lines = [meshOutlines(shell, lineMaterial), meshOutlines(meshes[3].geometry, lineMaterial)];
	shell.dispose();
	group.add(...lines);
	const points = [...roof, ...exterior, ...recess, ...ground]
		.flat()
		.map((point) => new Vector3(...stagePoint(point, origin)));
	const [left, right] = deck.entrance;
	return {
		group,
		bounds,
		orientation: {
			headingRad: Math.atan2(right[1] - left[1], right[0] - left[0]) + HEADING_OFFSET_RAD,
			elevationRad: ELEVATION_RAD
		},
		perspective: { distance, points },
		setPalette(palette) {
			for (const { paper, ink } of surfaces) {
				paper.set(palette.paper);
				ink.set(palette.ink);
			}
			lineMaterial.color.set(palette.ink);
		},
		dispose() {
			for (const mesh of meshes) {
				mesh.geometry.dispose();
				mesh.material.dispose();
			}
			for (const line of lines) line.geometry.dispose();
			lineMaterial.dispose();
		}
	};
}
