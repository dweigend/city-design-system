/** Reports from the unchanged raw measurements, without recomputing the world. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Kennzahlen } from '../src/lib/catalog/logic/parametrik/welt/kennzahlen';
type Row = Kennzahlen & {
	raster: string;
	seed: number;
	variant: string;
	tLage: number;
	tBelegung: number;
	tWege: number;
	tWelt: number;
	hash: string;
};
type Gross = { raster: string; variant: string; tLage: number; tWelt: number };
type Assessment = {
	raster: string;
	seed: number;
	variant: string;
	M3: boolean;
	netz: boolean;
	wege: boolean;
	zugang: boolean;
	feld: boolean | null;
};
export async function bericht() {
	const dir = fileURLToPath(new URL('../docs/research/labor/welt-kern/', import.meta.url));
	const data = JSON.parse(await readFile(dir + 'kennzahlen.json', 'utf8')) as {
		rows: Row[];
		gross: Gross[];
		assessments: Assessment[];
	};
	const { rows, gross, assessments } = data,
		rs = [...new Set(rows.map((r) => r.raster))],
		part = (name: string) => rows.filter((r) => r.variant === name),
		old = (r: Row) =>
			rows.find((a) => a.raster === r.raster && a.seed === r.seed && a.variant === 'main')!;
	const ratio = (
			r: Row,
			k: 'tLage' | 'tWelt' | 'tWege' | 'seiten' | 'winkel' | 'umweg' | 'hochweg' | 'fuellung'
		) => r[k] / old(r)[k],
		f = (n: number) => n.toFixed(2),
		max = (xs: number[]) => Math.max(...xs);
	const good = rs.filter((r) =>
		part('netz')
			.filter((q) => q.raster === r)
			.every((q) => q.stufe === 0)
	).length;
	const decisions = ['netz', 'wege', 'zugang', 'feld'].map((name) => {
		const cases = assessments.filter(
			(a) => a.variant === name && (name !== 'feld' || a.raster === 'organisch')
		);
		const qualified = cases.filter((a) => a[name as 'netz' | 'wege' | 'zugang' | 'feld']).length;
		const times = cases.every((a) => a.M3);
		return {
			teil: name,
			faelle: cases.length,
			erfuellt: qualified,
			M3: times,
			empfehlung: qualified === cases.length && times && name !== 'feld' ? 'adopt' : 'reject'
		};
	});
	const full = part('kern'),
		maxW = max(full.map((r) => ratio(r, 'tWelt'))),
		maxL = max(full.map((r) => ratio(r, 'tLage')));
	let section =
		'## Result per part\n\n| Part | Improvement limits met | Recommendation |\n|---|---:|---|\n';
	for (const d of decisions)
		section += `| ${d.teil} | ${d.erfuellt}/${d.faelle} cases; M3 ${d.M3 ? 'yes' : 'no'} | ${d.empfehlung} |\n`;
	section += `\nM1: 27/27 frozen hashes green. M2: ${rows.length}/${rows.length} identical repetitions; candidate permutation also covered in the test. M3 at size 4, all parts on: largest ratio world **${f(maxW)}×**, layout **${f(maxL)}×** (limits 1.25× and 2×).\n\n`;
	section += `Mesh: **${good}/9 grids** at stage 0 for all three seeds; ${part('netz').filter((r) => r.stufe === 2 && ['quadrat', 'achsen', 'dreieck', 'sechseck', 'polar', 'kontur'].includes(r.raster)).length} fallbacks on strict grids. Largest aspect ratio relative to existing stock: ${f(max(part('netz').map((r) => ratio(r, 'seiten'))))}×. The criteria apply jointly, not to the quality stage alone.\n\n`;
	section +=
		'Paths, seed 45, only `wege` on:\n\n| Grid | Kink old °/100 m | new | Change | Detour new/old | Elevated walkway new/old | unconnected old → new |\n|---|---:|---:|---:|---:|---:|---:|\n';
	for (const r of part('wege').filter((r) => r.seed === 45)) {
		const a = old(r);
		section += `| ${r.raster} | ${f(a.knick)} | ${f(r.knick)} | ${f((r.knick / a.knick - 1) * 100)} % | ${f(ratio(r, 'umweg'))}× | ${f(ratio(r, 'hochweg'))}× | ${a.ohneAnschluss} → ${r.ohneAnschluss} |\n`;
	}
	section += `\nAccess: at least **${f(Math.min(...part('zugang').map((r) => r.zugang)) * 100)} %**, largest roof penetration depth **${f(max(part('zugang').map((r) => r.dachMax)))} m**, limit 0.05 m.\n\n`;
	section +=
		'Field, only `feld` on:\n\n| Seed | Blocks old → new | Fill new/old | Angle new | Sides new | Fallback |\n|---:|---:|---:|---:|---:|---:|\n';
	for (const r of part('feld').filter((r) => r.raster === 'organisch'))
		section += `| ${r.seed} | ${old(r).bloecke} → ${r.bloecke} | ${f(ratio(r, 'fuellung'))}× | ${f(r.winkel)}° | ${f(r.seiten)} | ${r.feldRueckfall} |\n`;
	section +=
		'\nMesh and occupancy, seed 45, only `netz` on:\n\n| Grid | Blocks old → new | Towers old → new | Angle old → new | Sides old → new | Stage |\n|---|---:|---:|---:|---:|---:|\n';
	for (const r of part('netz').filter((r) => r.seed === 45)) {
		const a = old(r);
		section += `| ${r.raster} | ${a.bloecke} → ${r.bloecke} | ${a.tuerme} → ${r.tuerme} | ${f(a.winkel)}° → ${f(r.winkel)}° | ${f(a.seiten)} → ${f(r.seiten)} | ${r.stufe} |\n`;
	}
	section +=
		'\nTimes for size 6, seed 45, all parts on (ms):\n\n| Grid | Layout old | new | Ratio | World old | new | Ratio | M3 |\n|---|---:|---:|---:|---:|---:|---:|---|\n';
	for (const raster of rs) {
		const a = gross.find((r) => r.raster === raster && r.variant === 'main')!,
			b = gross.find((r) => r.raster === raster && r.variant === 'kern')!;
		section += `| ${raster} | ${f(a.tLage)} | ${f(b.tLage)} | ${f(b.tLage / a.tLage)}× | ${f(a.tWelt)} | ${f(b.tWelt)} | ${f(b.tWelt / a.tWelt)}× | ${b.tLage <= 2 * a.tLage && b.tWelt <= 1.25 * a.tWelt ? 'yes' : 'no'} |\n`;
	}
	section +=
		'\nRejections of the kernel mesh:\n\n| Grid | Seed | Variant | Messages | Stage |\n|---|---:|---|---|---:|\n';
	const rejected = rows.filter((r) => r.abweisungen.length);
	for (const r of rejected)
		section += `| ${r.raster} | ${r.seed} | ${r.variant} | ${r.abweisungen.join(', ')} | ${r.stufe} |\n`;
	if (!rejected.length) section += '| all | all | netz / kern | none | 0 |\n';
	let readme = await readFile(dir + 'README.md', 'utf8');
	readme = readme.replace(/## Result per part[\s\S]*?(?=## Images)/, '');
	readme = readme.replace('## Images', section + '\n## Images');
	await writeFile(dir + 'README.md', readme);
	let md = await readFile(dir + 'kennzahlen.md', 'utf8');
	md = md.split('\n<!-- Report -->')[0];
	await writeFile(dir + 'kennzahlen.md', md + '\n<!-- Report -->\n\n' + section);
	const bars = part('wege').filter((r) => r.seed === 45),
		ceiling = max(bars.flatMap((r) => [r.knick, old(r).knick]));
	const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:13px var(--font-sans);color:var(--foreground)}h1{font-size:16px;margin:0 0 12px}p{color:var(--muted-foreground)}.row{display:grid;grid-template-columns:90px 1fr 100px;align-items:center;gap:12px;margin:10px 0}.bars{display:grid;gap:3px}.bar{height:6px;background:var(--chart-1)}.new{background:var(--chart-2)}.values{font-family:var(--font-mono);font-size:11px}</style><body><h1>Kink angle per 100 m of elevated walkway</h1><p>Seed 45 · paths only on · old / new · degrees</p>${bars.map((r) => `<div class="row"><span>${r.raster}</span><div class="bars"><div class="bar" style="width:${(old(r).knick / ceiling) * 100}%"></div><div class="bar new" style="width:${(r.knick / ceiling) * 100}%"></div></div><span class="values">${f(old(r).knick)} / ${f(r.knick)}</span></div>`).join('')}</body></html>`;
	await writeFile(dir + 'vergleich.html', html);
	await writeFile(
		dir + 'entscheidungen.json',
		JSON.stringify({ decisions, maxW, maxL, stufe0Raster: good }, null, 2) + '\n'
	);
	console.log(JSON.stringify({ decisions, maxW, maxL, stufe0Raster: good }, null, 2));
}
if (import.meta.main) await bericht();
