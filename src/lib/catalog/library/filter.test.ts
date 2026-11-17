// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import {
	archiv,
	archivHerkunftText,
	baueArchiv,
	istFremd,
	type ArchivItem,
	type Herkunft
} from '../data/archiv';
import { designs } from '../data/designs';
import { library } from '../data/library';
import { references } from '../data/references';
import {
	activeTerms,
	applyFilter,
	emptyFilter,
	facetTerms,
	herkunftCount,
	toggleTerm
} from './filter';

const item = (key: string, herkunft: Herkunft, form: string[], material: string[]): ArchivItem => ({
	key,
	nr: key,
	herkunft,
	datei: `img/${key}.webp`,
	titel: key,
	listen: [],
	begriffe: { ansicht: [], stil: [], form, material, oberflaeche: [] }
});
const items = [
	item('A', 'roh', ['Cube', 'Tower'], ['Wood']),
	item('B', 'roh', ['Cube'], ['Glass']),
	item('C', 'eigen', ['Tower'], ['Wood']),
	item('D', 'ui', ['Sphere'], ['Concrete'])
];
const keys = (xs: ArchivItem[]) => xs.map((x) => x.key);

describe('Archive filter', () => {
	test('empty filter shows everything in data order', () => {
		expect(keys(applyFilter(items, emptyFilter()))).toEqual(['A', 'B', 'C', 'D']);
	});

	test('within a facet “or” applies', () => {
		const f = toggleTerm(toggleTerm(emptyFilter(), 'form', 'Tower'), 'form', 'Sphere');
		expect(keys(applyFilter(items, f))).toEqual(['A', 'C', 'D']);
	});

	test('between facets and provenance “and” applies', () => {
		const f = { ...toggleTerm(emptyFilter(), 'material', 'Wood'), herkunft: 'roh' as const };
		expect(keys(applyFilter(items, f))).toEqual(['A']);
		expect(herkunftCount(items, f, null)).toBe(2);
		expect(herkunftCount(items, f, 'eigen')).toBe(1);
	});

	test('facet counts ignore their own facet, order stays stable', () => {
		const f = toggleTerm(emptyFilter(), 'material', 'Glass');
		expect(facetTerms(items, f, 'form')).toEqual([
			{ term: 'Cube', count: 1 },
			{ term: 'Tower', count: 0 },
			{ term: 'Sphere', count: 0 }
		]);
		expect(facetTerms(items, f, 'material').find((t) => t.term === 'Wood')?.count).toBe(2);
	});

	test('toggling twice removes the term again', () => {
		const on = toggleTerm(emptyFilter(), 'form', 'Cube');
		expect(activeTerms(on)).toEqual([{ key: 'form', term: 'Cube' }]);
		expect(activeTerms(toggleTerm(on, 'form', 'Cube'))).toEqual([]);
	});
});

describe('Archive', () => {
	test('every image from all three collections exactly once', () => {
		expect(archiv.length).toBe(designs.length + library.length + references.length);
		expect(new Set(archiv.map((a) => a.key)).size).toBe(archiv.length);
		expect(new Set(archiv.map((a) => a.datei)).size).toBe(archiv.length);
	});

	test('provenance: original adaptations override historical external image ranges', () => {
		for (const d of designs) {
			const a = archiv.find((x) => x.key === `E${d.id}`);
			expect(a?.herkunft).toBe((d.eigen ?? !istFremd(d.id)) ? 'eigen' : 'fremd');
		}
		for (const nr of ['U20', 'U21', 'U22']) {
			expect(archiv.find((a) => a.nr === nr)?.herkunft).toBe('eigen');
		}
		expect(archiv.filter((a) => a.herkunft === 'roh').length).toBe(library.length);
		expect(archiv.filter((a) => a.herkunft === 'ui').length).toBe(
			references.filter((r) => !r.eigen).length
		);
	});

	test('external references: both number ranges with own designs in between', () => {
		for (const id of ['51', '92', '152', '163']) expect(istFremd(id)).toBe(true);
		for (const id of ['50', '93', '151', '164']) expect(istFremd(id)).toBe(false);
	});

	test('curated connection references are original adaptations', () => {
		const verbindungen = archiv.filter((a) => ['E156', 'E160', 'E163'].includes(a.key));
		for (const a of verbindungen) expect(a.herkunft).toBe('eigen');
		expect(verbindungen.map((a) => a.nr)).toEqual(['156', '160', '163']);
		for (const a of verbindungen) {
			expect(designs.find((d) => d.id === a.nr)?.tags).toContain('Connection');
		}
	});

	test('order: own, raw material, UI reference, external', () => {
		const rang = { eigen: 0, roh: 1, ui: 2, fremd: 3 };
		const r = archiv.map((a) => rang[a.herkunft]);
		expect(r).toEqual([...r].sort((a, b) => a - b));
	});
});

describe('Curation and original adaptations', () => {
	test('exactly the 20 original adaptations keep complete metadata', () => {
		const selected = archiv.filter((a) => a.zweck && a.zentrum);
		expect(archiv.filter((a) => a.herkunft === 'fremd' || a.herkunft === 'ui')).toEqual([]);
		expect(selected.map((a) => a.key).sort()).toEqual(
			[
				'E52',
				'E53',
				'E55',
				'E56',
				'E58',
				'E65',
				'E67',
				'E69',
				'E74',
				'E84',
				'E85',
				'E86',
				'E87',
				'E91',
				'E156',
				'E160',
				'E163',
				'U03',
				'U09',
				'U19'
			].sort()
		);
		for (const a of selected) {
			expect(a.herkunft).toBe('eigen');
			expect(a.datei).toMatch(/^img\/(adapt|uiref)-\d{3}-[a-z0-9-]+\.webp$/);
			expect(typeof a.vorbild).toBe('string');
			expect(a.zweck?.length).toBeGreaterThan(0);
			expect(['Technik', 'Stil', 'Prinzip', 'UI-Layout']).toContain(a.zentrum);
		}
	});

	test('unknown authors stay empty as reference', () => {
		for (const key of ['E52', 'E160', 'E163', 'U03']) {
			expect(archiv.find((a) => a.key === key)?.vorbild).toBe('');
		}
	});

	test('replaced image names the known reference in the archive', () => {
		const a = archiv.find((a) => a.key === 'E74');
		expect(a).toBeDefined();
		if (a) {
			expect(a.herkunft).toBe('eigen');
			expect(archivHerkunftText(a)).toBe(
				'Original adaptation after Archigram, Free Time Node: Trailer Cage'
			);
		}
	});

	test('own replacement keeps the number and changes the provenance', () => {
		const original = designs.find((d) => d.id === '74');
		if (!original) throw new Error('E74 missing');
		const [ersatz] = baueArchiv([{ ...original, eigen: true }], [], []);
		expect(ersatz.key).toBe('E74');
		expect(ersatz.herkunft).toBe('eigen');
		expect(archivHerkunftText(ersatz)).toBe(
			'Original adaptation after Archigram, Free Time Node: Trailer Cage'
		);
	});

	test('own replacement names the known reference', () => {
		const a = {
			...item('E74', 'eigen', [], []),
			vorbild: 'Archigram, Free Time Node: Trailer Cage',
			zweck: 'Megastructure as a shelf',
			zentrum: 'Stil' as const
		};
		expect(archivHerkunftText(a)).toBe(
			'Original adaptation after Archigram, Free Time Node: Trailer Cage'
		);
	});

	test('own replacement without a known source invents no reference', () => {
		const a = {
			...item('E52', 'eigen', [], []),
			vorbild: '',
			zweck: 'Building by combining',
			zentrum: 'Technik' as const
		};
		expect(archivHerkunftText(a)).toBe('Original adaptation');
		expect(archivHerkunftText(item('A', 'eigen', [], []))).toBe('Original designs');
	});
});
