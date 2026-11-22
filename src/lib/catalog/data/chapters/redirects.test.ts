import { expect, test } from 'bun:test';
import { chapters, legacyMove, legacyStep } from './index';

const paths = [
	['/', '/stadtbau#step-0'],
	['/stadt', '/stadtbau#step-0'],
	['/design', '/stadtbau#step-0'],
	['/raster', '/stadtbau#step-1'],
	['/wachstum', '/stadtbau#step-4'],
	['/modellierung', '/stadtbau#step-4'],
	['/formen', '/architektur#step-1'],
	['/formen/haus', '/architektur#step-4'],
	['/formlabor', '/architektur#step-2'],
	['/farben', '/oberflaechen#step-2'],
	['/fokus', '/oberflaechen#step-2'],
	['/material', '/oberflaechen#step-3'],
	['/interface', '/ui#step-0'],
	['/icons', '/ui#step-7'],
	['/labor', '/stadtbau#step-0'],
	['/prinzipien', '/stadtbau#step-3'],
	['/labor/assets', '/bausteine#step-0'],
	['/labor/assets?group=materials', '/oberflaechen#step-3'],
	['/labor/building-envelope', '/architektur#step-1'],
	['/labor/megastructure', '/versorgung#step-3'],
	['/labor/references', '/oberflaechen#step-5'],
	['/labor/traeger-neu', '/architektur#step-2'],
	['/designs', '/archiv'],
	['/bibliothek', '/archiv']
] as const;

const bookmarks = [
	['/#CITY-4', '/wege#step-2'],
	['/wachstum#GROW-2', '/stadtbau#step-6'],
	['/raster#GRID-2', '/stadtbau#step-2'],
	['/formen#FORM-10', '/architektur#step-8'],
	['/farben#COLOR-8', '/oberflaechen#step-1'],
	['/#weiterbauen', '/stadtbau#step-5'],
	['/#hochwege', '/wege#step-4'],
	['/#schwamm', '/versorgung#step-1'],
	['/#bauteile', '/versorgung#step-4'],
	['/raster#raster-grund', '/stadtbau#step-1'],
	['/raster#raster-vierecke', '/stadtbau#step-1'],
	['/raster#raster-spielraum', '/stadtbau#step-1'],
	['/raster#spatial-grid', '/stadtbau#step-2'],
	['/raster#court-growth', '/stadtbau#step-3'],
	['/wachstum#wachstum-wege', '/stadtbau#step-4'],
	['/formen#volume-section', '/architektur#step-1'],
	['/formen#construction-phases', '/architektur#step-8'],
	['/formen#traeger-wabe', '/architektur#step-2'],
	['/formen/haus#formen-ecken', '/architektur#step-1'],
	['/formen/haus#formen-weg', '/wege#step-4'],
	['/formen/haus#formen-stapel', '/architektur#step-2'],
	['/formen/haus#formen-verformung', '/architektur#step-2'],
	['/formen/haus#formen-vokabular', '/bausteine#step-0'],
	['/formen/haus#formen-komposition', '/architektur#step-3'],
	['/farben#farbe-ruhig', '/oberflaechen#step-2'],
	['/farben#farbe-stroeme', '/oberflaechen#step-2'],
	['/material#material-farbziel', '/oberflaechen#step-2'],
	['/material#material-familien', '/oberflaechen#step-3'],
	['/material#material-formen', '/oberflaechen#step-5'],
	['/material#material-rezept', '/oberflaechen#step-6'],
	['/interface#interface-hud', '/ui#step-2'],
	['/interface#interface-bedienung', '/ui#step-3'],
	['/interface#interface-haus', '/ui#step-4'],
	['/interface#connections', '/ui#step-5'],
	['/interface#fokus', '/ui#step-6'],
	['/interface#interface-icons', '/ui#step-7'],
	['/interface#interface-schrift', '/landschaft#step-4'],
	['/interface#engine-path', '/bausteine#step-7'],
	['/labor#labor-rechnen', '/stadtbau#step-3'],
	['/labor#labor-studien', '/architektur#step-2'],
	['/labor#labor-leitstil', '/oberflaechen#step-6'],
	['/raster#unknown', '/stadtbau#step-1']
] as const;

for (const [source, expected] of [...paths, ...bookmarks]) {
	test(`${source} moves to ${expected}`, () => {
		const url = new URL(source, 'https://example.test');
		const path = url.pathname.slice(1);
		const move = legacyMove(path, url.searchParams.get('group'));
		expect(move).toBeDefined();
		if (!move) return;
		if (move.archive) {
			expect(expected).toBe('/archiv');
			return;
		}
		const target = move.readsFragment ? legacyStep(path, url.hash) : move.target;
		expect(target).toBeDefined();
		if (!target) return;
		const [slug, step] = target;
		expect('/' + slug + '#' + step).toBe(expected);
		expect(
			chapters.find((chapter) => chapter.slug === slug)?.steps.some(({ id }) => id === step)
		).toBe(true);
	});
}

test('keeps canonical chapters, Archive and sandbox studies outside legacy navigation', () => {
	for (const path of [
		...chapters.map(({ slug }) => slug),
		'archiv',
		'sandbox',
		'sandbox/abnahme',
		'sandbox/haus',
		'sandbox/regel',
		'sandbox/stile',
		'sandbox/tal',
		'sandbox/tragwerk',
		'constructor',
		'labor/unknown'
	])
		expect(legacyMove(path)).toBeUndefined();
});
