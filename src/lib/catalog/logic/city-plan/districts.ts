import { defineRules, type NeighbourCell } from '../../core/neighbourhood';
import { BLOCK, cellId, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import { mix, type StyleWeights } from './character';

type Site = Pick<TerrainCell, 'column' | 'row'>;
type Centre = Site & { weights: StyleWeights };
const contacts = {
	composed: ['composed', 'megastructure', 'totem'],
	megastructure: ['composed', 'megastructure'],
	totem: ['composed', 'totem']
};

function influence(column: number, row: number, centres: readonly Centre[]) {
	let composed = 0,
		mega = 0,
		totem = 0;
	for (const centre of centres) {
		const d2 = (column - centre.column) ** 2 + (row - centre.row) ** 2;
		const weight = 1 / (16 + d2);
		composed += centre.weights.composed * weight;
		mega += centre.weights.megastructure * weight;
		totem += centre.weights.totem * weight;
	}
	return mix(composed, mega, totem);
}

/** Solves reciprocal contacts at block-scale samples. A district's collapsed form
 * contributes one fifth of its mix; the remaining share comes from nearby centres. */
export function planDistricts(grid: TerrainGrid, centres: readonly Centre[]) {
	const width = Math.ceil(grid.columns / BLOCK.columns) + 1;
	const height = Math.ceil(grid.rows / BLOCK.rows) + 1;
	const nodes = new Map<string, NeighbourCell>();
	const districts: Record<string, StyleWeights> = {};
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const id = cellId(x, y);
			const neighbors = [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1]
			].map(([a, b]) => (a >= 0 && b >= 0 && a < width && b < height ? cellId(a, b) : null));
			nodes.set(id, { id, neighbors, district: id, form: 'composed' });
			districts[id] = influence(x * BLOCK.columns, y * BLOCK.rows, centres);
		}
	const decisions = defineRules({ contacts, districts }).solve(
		nodes.keys(),
		nodes,
		grid.terrain.seed
	);
	for (const [id, { target }] of decisions) {
		const w = districts[id];
		districts[id] = mix(
			w.composed + 0.25 * Number(target === 'composed'),
			w.megastructure + 0.25 * Number(target === 'megastructure'),
			w.totem + 0.25 * Number(target === 'totem')
		);
	}
	return districts;
}

/** Samples a valid terrain cell or its column/row ID. Returns detached, unit-sum
 * method weights. Out-of-field or malformed addresses throw RangeError. */
export function styleWeightsAt(
	city: { districts: Readonly<Record<string, StyleWeights>> },
	site: Site | string
) {
	const [column, row] =
		typeof site === 'string' ? site.split('/').map(Number) : [site.column, site.row];
	if (typeof site === 'string' && cellId(column, row) !== site)
		throw new RangeError('Invalid city parcel: ' + site);
	if (!Number.isInteger(column) || !Number.isInteger(row))
		throw new RangeError('Expected integer parcel coordinates');
	const x = column / BLOCK.columns,
		y = row / BLOCK.rows;
	const ix = Math.floor(x),
		iy = Math.floor(y);
	let a = 0,
		b = 0,
		c = 0;
	for (const dx of [0, 1])
		for (const dy of [0, 1]) {
			const w = city.districts[cellId(ix + dx, iy + dy)];
			if (!w) throw new RangeError('Unknown city parcel: ' + cellId(column, row));
			const fraction = (1 - Math.abs(x - ix - dx)) * (1 - Math.abs(y - iy - dy));
			a += w.composed * fraction;
			b += w.megastructure * fraction;
			c += w.totem * fraction;
		}
	return mix(a, b, c);
}
