/**
 * Archive: every image in the Bible in one list. Three collections come together: the design
 * archive, the library of raw material and the references for the UI language. Every image
 * carries provenance and rights; all files live flat in static/img/ as
 * `<origin>-<nnn>-<view>-<subject>.webp`. Headless: no Svelte, no DOM.
 *
 * The curated designs in 51–92 and 152–163 are original adaptations.
 * Known references are kept as text metadata; originals exist only locally.
 */
import { designs, fitLabels, viewLabels, type Design } from './designs';
import { kindLabels, library, type RawItem } from './library';
import { references, type Reference } from './references';
import type { Uebertragung } from './uebertragung';

export type Herkunft = 'eigen' | 'roh' | 'ui' | 'fremd';

export const herkunftLabels: Record<Herkunft, string> = {
	eigen: 'Original designs',
	roh: 'Raw material',
	ui: 'UI reference',
	fremd: 'External references'
};

/** Rights per provenance in one sentence. */
export const lizenzText: Record<Herkunft, string> = {
	eigen: 'Original work. Free to use in the Bible and the game.',
	roh: 'Original raw material. Free to take apart and reuse.',
	ui: 'Third-party work, protected by copyright. For studying the design only, not for copying.',
	fremd:
		'Third-party work, protected by copyright. For study only; never an image template. Only the principle is adopted.'
};

export type ArchivFacet = 'ansicht' | 'stil' | 'form' | 'material' | 'oberflaeche';

export type ArchivListe = { titel: string; zeilen: string[] };

export type ArchivItem = Partial<Uebertragung> & {
	/** Unique across all collections. */
	key: string;
	/** Number as it appears in its collection (01, R12, U07). */
	nr: string;
	herkunft: Herkunft;
	/** Path under static/. */
	datei: string;
	titel: string;
	beschreibung?: string;
	/** Author or work, if known. */
	quelle?: string;
	/** Closeness to the shared design language (designs only). */
	naehe?: string;
	listen: ArchivListe[];
	begriffe: Record<ArchivFacet, string[]>;
};

const leer = (): Record<ArchivFacet, string[]> => ({
	ansicht: [],
	stil: [],
	form: [],
	material: [],
	oberflaeche: []
});

/** Historical number ranges of external references; original adaptations set `eigen` explicitly. */
export const istFremd = (id: string) => {
	const n = Number(id);
	return (n >= 51 && n <= 92) || (n >= 152 && n <= 163);
};

function ausEntwurf(d: Design): ArchivItem {
	const listen: ArchivListe[] = [
		{ titel: 'Adopt', zeilen: d.keep ?? [] },
		{ titel: 'Differs', zeilen: d.differs ?? [] },
		{ titel: 'For the procedural world', zeilen: d.procedural ?? [] }
	].filter((l) => l.zeilen.length > 0);
	return {
		key: `E${d.id}`,
		nr: d.id,
		herkunft: (d.eigen ?? !istFremd(d.id)) ? 'eigen' : 'fremd',
		datei: `img/${d.file}`,
		titel: d.title,
		beschreibung: d.description,
		quelle: d.source && d.source !== 'Eigenes Artwork' ? d.source : undefined,
		vorbild: d.vorbild,
		zweck: d.zweck,
		zentrum: d.zentrum,
		naehe: fitLabels[d.fit],
		listen,
		begriffe: { ...leer(), ansicht: [viewLabels[d.view]], stil: d.style }
	};
}

function ausBibliothek(r: RawItem): ArchivItem {
	return {
		key: r.id,
		nr: r.id,
		herkunft: 'roh',
		datei: `img/${r.file}`,
		titel: r.title,
		listen: [],
		begriffe: {
			...leer(),
			ansicht: [kindLabels[r.kind]],
			form: r.forms,
			material: r.materials,
			oberflaeche: r.surfaces
		}
	};
}

function ausReferenz(r: Reference): ArchivItem {
	// The file number stays stable even after other references are removed.
	const nr = `U${r.id ?? r.file.split('-')[1].slice(1)}`;
	return {
		key: nr,
		nr,
		herkunft: r.eigen ? 'eigen' : 'ui',
		quelle: r.eigen ? 'Original AI illustration' : undefined,
		vorbild: r.vorbild,
		zweck: r.zweck,
		zentrum: r.zentrum,
		datei: `img/${r.file}`,
		titel: r.title,
		listen: [],
		begriffe: { ...leer(), ansicht: ['Interface'] }
	};
}

const herkunftRang: Record<Herkunft, number> = { eigen: 0, roh: 1, ui: 2, fremd: 3 };

/**
 * All images: original designs, raw material, UI references, external references; within each
 * collection in its own order. The sort is stable.
 */
export function baueArchiv(entwuerfe: Design[], roh: RawItem[], ui: Reference[]): ArchivItem[] {
	return [...entwuerfe.map(ausEntwurf), ...roh.map(ausBibliothek), ...ui.map(ausReferenz)]
		.map((item, i) => ({ item, i }))
		.sort((a, b) => herkunftRang[a.item.herkunft] - herkunftRang[b.item.herkunft] || a.i - b.i)
		.map(({ item }) => item);
}

export const archiv: ArchivItem[] = baueArchiv(designs, library, references);

/** Only original replacement images get this label; third-party images keep their provenance. */
export function archivHerkunftText(item: ArchivItem): string {
	if (item.herkunft === 'eigen' && item.zweck && item.zentrum) {
		return item.vorbild ? `Original adaptation after ${item.vorbild}` : 'Original adaptation';
	}
	return herkunftLabels[item.herkunft];
}
