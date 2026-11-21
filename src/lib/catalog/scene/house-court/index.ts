import {
	Box3,
	Color,
	EdgesGeometry,
	Group,
	Line2NodeMaterial,
	Mesh,
	MeshBasicNodeMaterial
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
import { faceGeometry } from './geometry';

const PLOT_DEPTH = 0.24;
const FRAME_MARGIN = 0.5;
const ELEVATION_RAD = Math.PI / 3.2;
const HEADING_OFFSET_RAD = Math.PI / 9;

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

function surface(inkMix: number) {
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
	const shade = light.mul(-0.18).add(inkMix).clamp(0.03, 0.7);
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

function houseRings(house: HouseCourt) {
	const nodes = new Map(house.space.nodes.map(({ id, position }) => [id, position]));
	const court = new Set(house.court.cellIds);
	const courtFaces = new Set(
		house.space.faces
			.filter(({ uses }) => uses.some(({ cellId }) => court.has(cellId)))
			.map(({ id }) => id)
	);
	const exterior: CellPoint[][] = [];
	const recess: CellPoint[][] = [];
	for (const { id, nodeIds } of exposedHouseFaces(house)) {
		const target = courtFaces.has(id) ? recess : exterior;
		target.push(nodeIds.map((node) => required(nodes.get(node), 'house face node')));
	}
	return { exterior, recess };
}

/**
 * Creates the stage context for a filled house and its level parcel, in metres.
 * Projects exposed rings only. The stage supplies the live palette and owns disposal.
 */
export function createHouseCourtContext(deck: ParcelDeck, house: HouseCourt): StageContext {
	const group = new Group();
	const origin = deck.plotRing[0];
	const { exterior, recess } = houseRings(house);
	const ground = plotRings(deck.plotRing);
	const surfaces = [surface(0.21), surface(0.52), surface(0.34)];
	const meshes = [exterior, recess, ground].map(
		(rings, i) => new Mesh(faceGeometry(rings, origin), surfaces[i].material)
	);
	group.add(...meshes);
	const bounds = new Box3().setFromObject(group).expandByScalar(FRAME_MARGIN);
	const lineMaterial = new Line2NodeMaterial({
		linewidth: STRICHE.kontur,
		depthWrite: false,
		toneMapped: false
	});
	const shell = faceGeometry([...exterior, ...recess], origin);
	const lines = [meshOutlines(shell, lineMaterial), meshOutlines(meshes[2].geometry, lineMaterial)];
	shell.dispose();
	group.add(...lines);
	const [left, right] = deck.entrance;
	return {
		group,
		bounds,
		orientation: {
			headingRad: Math.atan2(right[1] - left[1], right[0] - left[0]) + HEADING_OFFSET_RAD,
			elevationRad: ELEVATION_RAD
		},
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
