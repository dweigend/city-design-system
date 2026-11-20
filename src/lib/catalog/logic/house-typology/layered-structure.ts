import type { HouseUse } from '../../data/house-body';
import {
	climb,
	columns,
	type Access,
	type HouseStructure,
	type Parcel,
	type Platform,
	type SkinPatch
} from '../house-structure';

type XY = [number, number];
/** Section radius of a wall line between two datums, metres. */
const WALL_RADIUS = 0.15;

type Layers = {
	id: string;
	ensemble: string;
	shellUse: HouseUse;
	ground: number;
	parcel: Parcel;
	/** Depth of every plate above the plinth, metres. */
	plate: number;
	/** One occupied course per datum, bottom to top. */
	floors: { datum: number; polygon: XY[]; holes: XY[][]; programme: HouseUse[]; height: number }[];
	/** The surveyed wall line at every datum, and which faces stay exposed. */
	exterior: {
		stations: { z: number; ring: XY[] }[];
		faces: boolean[];
		fabric?: { pressure: number; tension: number };
	};
	roofWalk: { polygon: XY[]; holes: XY[][] };
	/** Plan position and kind of the single vertical access. */
	access: { axis: XY; kind: Access['kind'] };
	/** Use of the roof installation; without it the roof walk is a terrace. */
	crownUse?: HouseUse;
};

function platforms(layers: Layers, name: (corner: number, level: number) => string): Platform[] {
	const corners = layers.exterior.stations[0].ring.map((_, corner) => corner);
	const rooms = layers.floors.map((floor, level): Platform => ({
		id: layers.id + '/platform/' + level,
		datum: floor.datum,
		thickness: level ? layers.plate : floor.datum - layers.ground,
		outline: floor.polygon,
		holes: floor.holes,
		bearers: corners.map((corner) => name(corner, level)),
		programme: floor.programme,
		room: { height: floor.height }
	}));
	const top = layers.exterior.stations.length - 1;
	return [
		...rooms,
		{
			id: layers.id + '/platform/roof',
			datum: layers.exterior.stations[top].z,
			thickness: layers.plate,
			outline: layers.roofWalk.polygon,
			holes: layers.roofWalk.holes,
			bearers: corners.map((corner) => name(corner, top)),
			programme: []
		}
	];
}

function faces(layers: Layers, name: (corner: number, level: number) => string): SkinPatch[] {
	const count = layers.exterior.stations[0].ring.length,
		top = layers.exterior.stations.length - 1;
	const fabric = layers.exterior.fabric;
	return layers.exterior.faces.flatMap((exposed, corner): SkinPatch[] => {
		if (!exposed) return [];
		const next = (corner + 1) % count;
		return [
			{
				id: layers.id + '/face/' + corner,
				slot: 'shell',
				use: layers.shellUse,
				boundary: [
					{ node: name(corner, 0) },
					{ node: name(next, 0) },
					{ node: name(next, top) },
					{ node: name(corner, top) }
				],
				...(fabric ? { membrane: { pressure: fabric.pressure, tension: fabric.tension } } : {})
			}
		];
	});
}

/**
 * States a layered house in the shared structure contract: a room on every datum, a wall line
 * on every surveyed corner, one skin per exposed face, one access chain and the roof walk.
 * Units are world metres. The result is detached from the courses it describes.
 */
export function layeredStructure(layers: Layers): HouseStructure {
	const walls = columns(layers.id + '/wall', layers.exterior.stations, WALL_RADIUS);
	const decks = platforms(layers, walls.name);
	const roof = decks[decks.length - 1].id;
	return {
		id: layers.id,
		principle: 'layers',
		ensemble: layers.ensemble,
		use: layers.floors[0].programme[0],
		ground: layers.ground,
		parcel: layers.parcel,
		nodes: walls.nodes,
		rods: walls.rods,
		platforms: decks,
		skins: faces(layers, walls.name),
		access: climb(layers.ground, layers.access.kind, decks, layers.access.axis),
		roof: layers.crownUse
			? { kind: 'crown', platform: roof, use: layers.crownUse }
			: { kind: 'terrace', platform: roof }
	};
}
