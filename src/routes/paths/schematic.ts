import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { mesh } from '../../lib/core/mesh';
import {
	createMovementNetwork,
	type MovementLink,
	type MovementNode
} from '../../lib/domain/movement-network';
import type { TransitLine } from '../../lib/domain/transit-line';
import {
	projectMovement,
	projectMovementRoute,
	projectTransitLine,
	type MovementDrawing,
	type PathsFrame
} from '../../lib/scene/paths-projection';
import type { ViewFit } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';

export const walkwayLevels = [
	{ value: '0', level: 0, heightM: 0, label: 'Ground only' },
	{ value: '1', level: 1, heightM: 7, label: 'Level 1 (+7 m)' },
	{ value: '2', level: 2, heightM: 14, label: 'Level 2 (+14 m)' }
] as const;
type WalkwayLevel = (typeof walkwayLevels)[number]['level'];

export const routePairs = [
	{ value: 'court', label: 'Gate → Court', from: 'west-gate', to: 'east-court' },
	{ value: 'quay', label: 'Gate → Quay', from: 'west-gate', to: 'east-quay' }
] as const;
type RoutePair = (typeof routePairs)[number];

const groundNodes = {
	'west-gate': [-58, 4],
	'west-detour': [-58, -34],
	'yard-corner': [-16, -34],
	'west-landing': [-13, -17],
	'east-landing': [13, -17],
	'east-court': [46, 4],
	'east-turn': [16, 20],
	'east-quay': [29, 29]
} as const;

// Each level crosses the same yard at a different point. The upper deck lies closer
// to the straight line from the gate to the bridge.
const upperNodes = {
	'lower-entry': [-39, 21, 1],
	'lower-exit': [-28, 21, 1],
	'upper-entry': [-39, -3, 2],
	'upper-exit': [-28, -9, 2]
} as const;

type NodeId = keyof typeof groundNodes | keyof typeof upperNodes;
type Kind = 'lane' | 'bridge' | 'stair' | 'walkway';

const nodes: readonly MovementNode[] = [
	...Object.entries(groundNodes).map(([id, [x, y]]): MovementNode => ({
		id,
		position: [x, y, 0],
		level: 'ground'
	})),
	...Object.entries(upperNodes).map(([id, [x, y, level]]): MovementNode => ({
		id,
		position: [x, y, walkwayLevels[level].heightM],
		level
	}))
];

const connections = [
	['gate-detour', 'lane', 'west-gate', 'west-detour'],
	['south-yard', 'lane', 'west-detour', 'yard-corner'],
	['west-bank', 'lane', 'yard-corner', 'west-landing'],
	['river-bridge', 'bridge', 'west-landing', 'east-landing'],
	['court-lane', 'lane', 'east-landing', 'east-court'],
	['east-bank', 'lane', 'east-landing', 'east-turn'],
	['quay-lane', 'lane', 'east-turn', 'east-quay'],
	['court-quay', 'lane', 'east-court', 'east-quay'],
	['lower-gate-stair', 'stair', 'west-gate', 'lower-entry'],
	['lower-deck', 'walkway', 'lower-entry', 'lower-exit'],
	['lower-bridge-stair', 'stair', 'lower-exit', 'west-landing'],
	['upper-gate-stair', 'stair', 'west-gate', 'upper-entry'],
	['upper-deck', 'walkway', 'upper-entry', 'upper-exit'],
	['upper-bridge-stair', 'stair', 'upper-exit', 'west-landing']
] as const satisfies readonly (readonly [string, Kind, NodeId, NodeId])[];

const drawings: Readonly<Record<Kind, MovementDrawing>> = {
	lane: 'trace',
	bridge: 'bridge',
	stair: 'stairs',
	walkway: 'deck'
};

const westM = -65;
const eastM = 54;
const southM = -40;
const northM = 37;
const halfRiverWidthM = 9;
const bankDepthM = 3;

const frame: PathsFrame = {
	toLocal: (x, y) => [x, y],
	footprint: { width: eastM - westM, depth: northM - southM }
};

// The fixed frame keeps both shortcuts in view without recentering when they appear.
export const schematicFit: ViewFit = {
	fill: 0.82,
	focus: { min: [westM, southM, -bankDepthM], max: [eastM, northM, walkwayLevels[2].heightM] }
};

function slab(id: string, min: Vec3, max: Vec3, color: Drawable['color']): Drawable {
	const [x, y, z] = min;
	const [u, v, w] = max;
	return {
		id,
		shape: {
			kind: 'box',
			center: [(x + u) / 2, (y + v) / 2, (z + w) / 2],
			size: [u - x, v - y, w - z],
			rotation: 0
		},
		color,
		finish: 'matte'
	};
}

// The yard sits between the two elevated landings. Its continuous wall makes the omitted
// ground connection visible in both views.
function yardDrawables(): Drawable[] {
	const west = -37;
	const east = -30;
	const south = -22;
	const north = 24;
	const wallWidthM = 0.6;
	const wallHeightM = 2;
	const floorHeightM = 0.1;
	const wallColor = '--ink-3';
	return [
		slab('yard-floor', [west, south, 0], [east, north, floorHeightM], '--paper-3'),
		slab('yard-west-wall', [west, south, 0], [west + wallWidthM, north, wallHeightM], wallColor),
		slab('yard-east-wall', [east - wallWidthM, south, 0], [east, north, wallHeightM], wallColor),
		slab(
			'yard-south-wall',
			[west + wallWidthM, south, 0],
			[east - wallWidthM, south + wallWidthM, wallHeightM],
			wallColor
		),
		slab(
			'yard-north-wall',
			[west + wallWidthM, north - wallWidthM, 0],
			[east - wallWidthM, north, wallHeightM],
			wallColor
		)
	];
}

const context: readonly Drawable[] = [
	slab(
		'west-bank-ground',
		[westM, southM, -bankDepthM],
		[-halfRiverWidthM, northM, 0],
		'--paper-2'
	),
	slab('east-bank-ground', [halfRiverWidthM, southM, -bankDepthM], [eastM, northM, 0], '--paper-2'),
	{
		...slab(
			'river',
			[-halfRiverWidthM, southM, -bankDepthM],
			[halfRiverWidthM, northM, -1],
			'--water'
		),
		flat: true
	},
	...yardDrawables()
];

function movementLinks(active: readonly MovementNode[]): MovementLink<Kind>[] {
	const byId = new Map(active.map((node) => [node.id, node]));
	return connections.flatMap(([id, kind, from, to]) => {
		const a = byId.get(from)?.position;
		const b = byId.get(to)?.position;
		if (!a || !b) return [];
		const cost = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
		const supports =
			kind === 'walkway'
				? [a, b].map((top) => ({ base: [top[0], top[1], 0] as const, top }))
				: undefined;
		return [{ id, kind, nodeIds: [from, to], cost, supports }];
	});
}

function nodeMarks(active: readonly MovementNode[]): Drawable {
	const body = mesh();
	const radiusM = 0.9;
	const liftM = 0.7;
	for (const { position } of active) body.pier(position, position[2] + liftM, radiusM);
	return {
		id: 'movement-nodes',
		shape: required(body.shape(), 'schematic nodes'),
		color: '--path',
		finish: 'matte',
		flat: true
	};
}

// Fixed, city-independent elevated guideway crossing both banks north of the yard, with one station beside east-quay.
const transitZ = walkwayLevels[1].heightM;
const transitY = 31;
const schematicTransitLine: TransitLine = {
	points: [
		[-56, transitY, transitZ],
		[48, transitY, transitZ]
	],
	piers: [-46, -15, 15, 44].map((x) => ({
		top: [x, transitY, transitZ],
		base: [x, transitY, 0]
	})),
	stations: [
		{
			id: 'quay-station',
			approachId: 'east-quay',
			position: [29, transitY, transitZ],
			base: [29, transitY, 0],
			stationM: 85
		}
	],
	wetRuns: 1,
	lengthM: 104,
	gradeRatio: 0,
	minimumRadiusM: Infinity
};

const transitDrawables: readonly Drawable[] = projectTransitLine(
	schematicTransitLine,
	frame
).drawables;

/** Builds a fresh movement graph and scene for levels up to the selected level, in meters. */
export function createSchematic(level: WalkwayLevel) {
	const active = nodes.filter((node) => node.level === 'ground' || node.level <= level);
	const network = createMovementNetwork(active, movementLinks(active));
	const { drawables } = projectMovement(network, drawings, frame);
	return {
		network,
		elevatedEdges: network.edges.filter(({ kind }) => kind === 'stair' || kind === 'walkway')
			.length,
		drawables: [...context, ...transitDrawables, ...drawables, nodeMarks(active)]
	};
}

export type SchematicSelection =
	| Readonly<{
			kind: 'node';
			value: string;
			id: string;
			levelLabel: string;
			connections: readonly string[];
			drawable: Drawable;
	  }>
	| Readonly<{
			kind: 'edge';
			value: string;
			id: string;
			edgeKind: Kind;
			from: string;
			to: string;
			lengthM: number;
			drawable: Drawable;
	  }>;

/** Lists keyboard-selectable graph nodes and edges currently active in the schematic. */
export function readSchematicElements(schematic: ReturnType<typeof createSchematic>) {
	const { nodes: activeNodes, edges: activeEdges } = schematic.network;
	return [
		{ value: 'none', label: 'None' },
		...activeNodes.map(({ id }) => ({ value: `node:${id}`, label: `Node · ${id}` })),
		...activeEdges.map(({ id }) => ({ value: `edge:${id}`, label: `Edge · ${id}` }))
	];
}

/** Highlights and describes one active node or edge, returning undefined when absent at this level. */
export function readSchematicSelection(
	schematic: ReturnType<typeof createSchematic>,
	value: string
): SchematicSelection | undefined {
	if (value.startsWith('node:')) {
		const id = value.slice('node:'.length);
		const node = schematic.network.nodes.find((item) => item.id === id);
		if (!node) return undefined;
		const body = mesh();
		body.pier(node.position, node.position[2] + 2.4, 1.8);
		return {
			kind: 'node',
			value,
			id: node.id,
			levelLabel:
				node.level === 'ground' ? 'Ground (0 m)' : `Level ${node.level} (+${node.position[2]} m)`,
			connections: schematic.network.edges
				.filter(({ nodeIds }) => nodeIds[0] === id || nodeIds[1] === id)
				.map((edge) => edge.id),
			drawable: {
				id: `inspect-node-${id}`,
				shape: required(body.shape(), 'inspected schematic node'),
				color: '--blueprint',
				finish: 'matte',
				flat: true
			}
		};
	}
	if (value.startsWith('edge:')) {
		const id = value.slice('edge:'.length);
		const edge = schematic.network.edges.find((item) => item.id === id);
		if (!edge) return undefined;
		const [from, to] = edge.nodeIds;
		const byId = new Map(schematic.network.nodes.map((node) => [node.id, node]));
		const a = required(byId.get(from)?.position, 'inspected edge start');
		const b = required(byId.get(to)?.position, 'inspected edge end');
		const lift = 0.9;
		const body = mesh();
		body.pier(a, a[2] + 1.8, 1.3);
		body.pier(b, b[2] + 1.8, 1.3);
		return {
			kind: 'edge',
			value,
			id: edge.id,
			edgeKind: edge.kind,
			from,
			to,
			lengthM: edge.lengthM,
			drawable: {
				id: `inspect-edge-${id}`,
				shape: required(body.shape(), 'inspected schematic edge'),
				color: '--blueprint',
				finish: 'matte',
				flat: true,
				stroke: { color: '--blueprint', width: 2.5, opacity: 1 },
				strokeSegments: [a[0], a[1], a[2] + lift, b[0], b[1], b[2] + lift]
			}
		};
	}
	return undefined;
}

/** Measures and highlights the least-distance route in the current schematic. */
export function readSchematicRoute(schematic: ReturnType<typeof createSchematic>, pair: RoutePair) {
	const { network } = schematic;
	const route = required(network.readRoute(pair.from, pair.to), 'schematic route');
	return {
		route,
		levelChanges: route.edges.filter(({ kind }) => kind === 'stair').length,
		drawables: projectMovementRoute(network, route, drawings, frame).drawables
	};
}
