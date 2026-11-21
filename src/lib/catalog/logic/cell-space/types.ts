export type CellPoint = readonly [x: number, y: number, z: number];
export type CellNode = Readonly<{ id: string; position: CellPoint }>;
export type FaceRing = Readonly<{ id: string; nodeIds: readonly string[] }>;
export type FaceUse = Readonly<{ cellId: string; direction: 1 | -1 }>;
export type CellFace = FaceRing & Readonly<{ uses: readonly FaceUse[] }>;
export type CellShell = Readonly<{ id: string; faceIds: readonly string[] }>;
export type SpaceCell = CellShell & Readonly<{ volumeM3: number }>;

export type CellSpace = Readonly<{
	nodes: readonly CellNode[];
	faces: readonly CellFace[];
	cells: readonly SpaceCell[];
}>;

export type CellSpaceInput = Readonly<{
	nodes: readonly CellNode[];
	faces: readonly FaceRing[];
	cells: readonly CellShell[];
}>;
