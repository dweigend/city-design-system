import {
	crossProduct,
	displacement,
	dotProduct,
	length,
	type Vec3
} from '../../../lib/core/geometry';
import { createMeshObject, mesh, squareSegment } from '../../../lib/core/mesh';
import {
	createCityLattice,
	createLatticeBayObject,
	type LatticeVariant
} from '../../../lib/domain/city-volume';
import {
	createDockedModule,
	readLatticeFaceSockets,
	type DockFit,
	type FaceSocket
} from '../../../lib/domain/face-dock';
import { resolveSurfaces, type Drawable, type SurfaceAssignment } from '../../../lib/scene/surface';

const plan: readonly Vec3[] = [
	[-6, -3, 0],
	[0, -6, 0],
	[6, -3, 0],
	[6, 3, 0],
	[0, 6, 0],
	[-6, 3, 0]
];
const column = {
	planCellId: 'carrier',
	corners: plan.map((position, index) => ({ id: String(index), position })),
	neighbors: plan.map(() => null),
	levels: 4
};
const bearing = Math.PI / 5;
const elevation = Math.PI / 8;
const front: Vec3 = [
	Math.sin(bearing) * Math.cos(elevation),
	-Math.cos(bearing) * Math.cos(elevation),
	Math.sin(elevation)
];

export const fit = { bearing, elevation, fill: 0.86 };
export const section = { normal: [1, 0, 0] as const, constant: -1 };

const carrierSurfaces = {
	solid: { color: '--model-grey', finish: 'matte' },
	member: { color: '--model-roof', finish: 'matte' }
} as const satisfies SurfaceAssignment;

const moduleSurfaces = {
	body: { color: '--model-cream', finish: 'matte', preserveColor: true },
	'dock-collar': { color: '--model-orange', finish: 'matte', preserveColor: true }
} as const satisfies SurfaceAssignment;

function visibleSockets(sockets: readonly FaceSocket[]) {
	return sockets
		.filter(({ normal }) => dotProduct(normal, front) > 0.22 && Math.abs(normal[2]) < 0.95)
		.toSorted((a, b) => Math.abs(b.normal[2]) - Math.abs(a.normal[2]) || b.center[2] - a.center[2]);
}

function moduleSpec(socket: FaceSocket, id: string) {
	const clearance = Math.min(
		...socket.polygon.map((point, index, ring) => {
			const edge = displacement(point, ring[(index + 1) % ring.length]);
			return length(crossProduct(edge, displacement(point, socket.center))) / length(edge);
		})
	);
	return {
		id,
		widthM: clearance * 1.35,
		heightM: clearance * 1.05,
		depthM: Math.min(clearance * 1.45, 2.8)
	};
}

function dockModules(lattice: ReturnType<typeof createCityLattice>) {
	const candidates = visibleSockets(readLatticeFaceSockets(lattice));
	const accepted: Extract<DockFit, { status: 'docked' }>[] = [];
	let rejected = 0;
	function trySocket(socket: FaceSocket, id: string) {
		const result = createDockedModule(socket, moduleSpec(socket, id), {
			occupiedBounds: accepted.map(({ bounds }) => bounds)
		});
		if (result.status === 'docked') accepted.push(result);
		else if (result.reason === 'occupied-overlap') rejected++;
	}
	for (const socket of candidates) {
		trySocket(socket, 'module');
		// Give the first socket a competing module to exercise the occupancy check.
		if (accepted.length === 1 && socket === candidates[0]) trySocket(socket, 'alternate');
		if (accepted.length === 5) break;
	}
	return { accepted, rejected };
}

function carrierDrawables(lattice: ReturnType<typeof createCityLattice>): Drawable[] {
	const solids = lattice.cells.flatMap(({ id }) =>
		resolveSurfaces(createLatticeBayObject(lattice, id), carrierSurfaces)
			.filter((part) => part.id === 'solid')
			.map((part) => ({ ...part, id: `${id}/solid` }))
	);
	const positions = new Map(lattice.nodes.map(({ id, position }) => [id, position]));
	const members = mesh();
	for (const { from, to } of lattice.edges) {
		const a = positions.get(from);
		const b = positions.get(to);
		if (a && b && length(displacement(a, b))) members.append(squareSegment(a, b, 0.15));
	}
	const frame = createMeshObject('carrier-frame', { member: members }, []);
	return [...solids, ...resolveSurfaces(frame, { member: carrierSurfaces.member })];
}

export function buildStudy(variant: LatticeVariant) {
	const lattice = createCityLattice([column], 0, variant);
	const { accepted, rejected } = dockModules(lattice);
	const modules = accepted.flatMap(({ object }) =>
		resolveSurfaces(object, moduleSurfaces).map((part) => ({
			...part,
			id: `${object.id}/${part.id}`
		}))
	);
	return {
		drawables: [...carrierDrawables(lattice), ...modules],
		docked: accepted.length,
		rejected,
		joints: modules.filter(({ id }) => id.endsWith('/dock-collar')).length
	};
}
