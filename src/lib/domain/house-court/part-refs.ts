import type { Part, Shape } from '../../core/object';
import { encodeKey, type Ref } from '../../core/ref';
import { readStoreyKey, type CellSpace } from '../cell-space';
import { boxMesh, faceMesh, type Box } from './boxes';
import type { Vec3 } from '../../core/geometry';
import type { HouseOccupancy, StoreyProgram } from '../massing';

export type StoreyRun = readonly [cellId: string, fromStorey: number, toStorey: number];
export type HousePart = Part &
	Readonly<{
		runs: readonly StoreyRun[];
		programRun?: StoreyRun;
		body?: boolean;
	}>;

export const groundStorey = /* Exact arithmetic: zero-based ground storey index. */ 0;

export function groundStoreyRuns(cellId: string): readonly StoreyRun[] {
	return [[cellId, groundStorey, groundStorey + 1]];
}

/** A part's identity and the addressed storeys it serves. The span end is exclusive.
 * Shared meshes report a null cellId and list the contributing storeys across their cells. */
export type HousePartAddress = Readonly<{
	key: string;
	partId: string;
	slot: string;
	cellId: string | null;
	storeySpan: readonly [number, number];
	storeyKeys: readonly string[];
	program?: StoreyProgram;
	body?: boolean;
}>;

/** Part and storey addresses resolved in one supplied world. */
export type HousePartRef = Omit<HousePartAddress, 'key' | 'storeyKeys'> &
	Readonly<{ ref: Ref<'house-part'>; storeyRefs: readonly Ref<'storey'>[] }>;

function shapeParts<T>(
	id: string,
	slot: string,
	source: readonly T[],
	runs: readonly StoreyRun[],
	mesh: (source: readonly T[]) => Shape
): HousePart[] {
	if (!source.length) return [];
	return lazyParts(id, slot, runs, () => mesh(source));
}

function lazyParts(
	id: string,
	slot: string,
	runs: readonly StoreyRun[],
	build: () => Shape,
	flags?: Pick<HousePart, 'body' | 'programRun'>
): HousePart[] {
	if (!runs.length) return [];
	let shape: Shape | undefined;
	return [
		{
			id,
			slot,
			runs,
			...flags,
			get shape() {
				return (shape ??= build());
			}
		}
	];
}

export const lazyFaceParts = (
	id: string,
	slot: string,
	runs: readonly StoreyRun[],
	faces: () => readonly (readonly Vec3[])[],
	flags?: Pick<HousePart, 'body' | 'programRun'>
) => lazyParts(id, slot, runs, () => faceMesh(faces()), flags);

export const slicePartId = (cell: string, kind: 'body' | 'envelope', datumIndex: number) =>
	`${cell}/${kind}/datum/${datumIndex}`;

export const boxParts = (
	id: string,
	slot: string,
	boxes: readonly Box[],
	runs: readonly StoreyRun[]
) => shapeParts(id, slot, boxes, runs, boxMesh);

export function partAddresses(
	houseId: string,
	space: CellSpace,
	house: HouseOccupancy,
	parts: readonly HousePart[]
): readonly HousePartAddress[] {
	const programs = new Map(
		house.cells.flatMap(
			({ program }) => program?.map(({ key, phase, use }) => [key, { phase, use }] as const) ?? []
		)
	);
	return Object.freeze(
		parts.map(({ id, slot, runs, programRun, body }) => {
			const keys = new Set<string>();
			let from = Infinity;
			let to = -Infinity;
			const cellId = runs[0][0];
			for (const [cell, bottom, top] of runs) {
				from = Math.min(from, space.datumIndex + bottom);
				to = Math.max(to, space.datumIndex + top);
				for (let storey = bottom; storey < top; storey += 1)
					keys.add(readStoreyKey(space.id, cell, space.datumIndex + storey));
			}
			const storeyKeys = [...keys];
			const programKey =
				programRun && readStoreyKey(space.id, programRun[0], space.datumIndex + programRun[1]);
			const program = programs.get(programKey ?? storeyKeys[0]);
			const uniform =
				program &&
				(programKey ||
					storeyKeys.every((key) => {
						const other = programs.get(key);
						return other?.phase === program.phase && other.use === program.use;
					}));
			return Object.freeze({
				key: encodeKey([houseId, id]),
				partId: id,
				slot,
				cellId: runs.every(([cell]) => cell === cellId) ? cellId : null,
				storeySpan: Object.freeze<[number, number]>([from, to]),
				storeyKeys: Object.freeze(storeyKeys),
				...(body ? { body } : {}),
				...(uniform ? { program: Object.freeze(program) } : {})
			});
		})
	);
}
