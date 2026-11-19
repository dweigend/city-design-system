import { required } from '../src/lib/catalog/logic/required';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { welt, weltDefaults, rasterarten } from '../src/lib/catalog/logic/parametrik/welt';
import { KERN_AN, KERN_AUS, type KernTeile } from '../src/lib/catalog/logic/parametrik/welt/typen';
import { kennzahlen, hash } from '../src/lib/catalog/logic/parametrik/welt/kennzahlen';
import { lage } from '../src/lib/catalog/logic/parametrik/welt/lage';
import { lageKern } from '../src/lib/catalog/logic/parametrik/welt/kernlage';
import { belegung } from '../src/lib/catalog/logic/parametrik/welt/belegung';
import { zugangSichern } from '../src/lib/catalog/logic/parametrik/welt/zugang';
import { wege } from '../src/lib/catalog/logic/parametrik/welt/wege';
import { wegeKern } from '../src/lib/catalog/logic/parametrik/welt/ports';
const dir = fileURLToPath(new URL('../docs/research/labor/welt-kern/', import.meta.url));
await mkdir(dir, { recursive: true });
const variants: Record<string, KernTeile> = {
	main: KERN_AUS,
	kern: KERN_AN,
	...Object.fromEntries(Object.keys(KERN_AUS).map((k) => [k, { ...KERN_AUS, [k]: true }]))
};
const median = (ns: number[]) => ns.sort((a, b) => a - b)[Math.floor(ns.length / 2)];
const rows: (ReturnType<typeof kennzahlen> & {
	raster: (typeof rasterarten)[number]['id'];
	seed: number;
	groesse: number;
	variant: string;
	hash: ReturnType<typeof hash>;
	tLage?: number;
	tBelegung?: number;
	tWege?: number;
	tWelt?: number;
})[] = [];
for (const { id: raster } of rasterarten)
	for (const seed of [1, 19, 45])
		for (const [variant, kern] of Object.entries(variants)) {
			const p = { ...weltDefaults, raster, seed, kern },
				metrics = kennzahlen(p),
				timings: { tLage: number; tBelegung: number; tWege: number; tWelt: number }[] = [];
			welt(p);
			for (let run = 0; run < 7; run++) {
				let t = performance.now();
				const r = (kern.netz ? lageKern : lage)({ ...p, feld: kern.feld });
				const tLage = performance.now() - t;
				t = performance.now();
				const b = belegung(r, p);
				if (kern.zugang) zugangSichern(r, b);
				const tBelegung = performance.now() - t;
				t = performance.now();
				(kern.wege ? wegeKern : wege)(r, b, Math.max(1, Math.round(r.blocks.length / 6)));
				const tWege = performance.now() - t;
				welt(p);
				t = performance.now();
				welt({ ...p, dichte: p.dichte + 0.001 });
				const tWelt = performance.now() - t;
				if (run >= 2) timings.push({ tLage, tBelegung, tWege, tWelt });
			}
			const times = Object.fromEntries(
				['tLage', 'tBelegung', 'tWege', 'tWelt'].map((k) => [
					k,
					median(timings.map((t) => t[k as keyof typeof t]))
				])
			);
			const json = JSON.stringify(welt(p)),
				h = hash(json);
			if (h !== hash(JSON.stringify(welt(p)))) throw new Error('Nondeterministic ' + raster);
			rows.push({ raster, seed, groesse: 4, variant, ...metrics, ...times, hash: h });
			console.log(raster, seed, variant);
		}
// Size 6: the same timing, only seed 45, main and all parts on.
const gross = [];
for (const { id: raster } of rasterarten)
	for (const [variant, kern] of Object.entries(variants).filter(
		([v]) => v === 'main' || v === 'kern'
	)) {
		const p = { ...weltDefaults, raster, seed: 45, groesse: 6, kern },
			times = [];
		for (let i = 0; i < 7; i++) {
			let t = performance.now();
			const r = (kern.netz ? lageKern : lage)({ ...p, feld: kern.feld });
			const tLage = performance.now() - t;
			t = performance.now();
			const b = belegung(r, p);
			if (kern.zugang) zugangSichern(r, b);
			const tBelegung = performance.now() - t;
			t = performance.now();
			(kern.wege ? wegeKern : wege)(r, b, Math.max(1, Math.round(r.blocks.length / 6)));
			const tWege = performance.now() - t;
			welt(p);
			t = performance.now();
			welt({ ...p, dichte: p.dichte + 0.001 });
			if (i >= 2) times.push({ tLage, tBelegung, tWege, tWelt: performance.now() - t });
		}
		gross.push({
			raster,
			variant,
			tLage: median(times.map((t) => t.tLage)),
			tBelegung: median(times.map((t) => t.tBelegung)),
			tWege: median(times.map((t) => t.tWege)),
			tWelt: median(times.map((t) => t.tWelt))
		});
	}
const groups = {
	Mesh: [
		'bloecke',
		'zellen',
		'fuellung',
		'winkel',
		'seiten',
		'js',
		'stufe',
		'haengend',
		'feldRueckfall'
	],
	Occupancy: ['tuerme', 'eingriffe'],
	Access: ['zugang', 'frontMin', 'dachMax', 'dachZahl'],
	Paths: ['hochweg', 'laeufe', 'schleifen', 'diagonalen', 'knick', 'umweg', 'ohneAnschluss'],
	Time: ['tLage', 'tBelegung', 'tWege', 'tWelt']
};
let md =
	'# World kernel: measurement comparison\n\nMedian of five runs after two warm-up runs. Time in ms. All single variants against main; criteria and limits remain unchanged.\n';
for (const [group, keys] of Object.entries(groups)) {
	md += `\n## ${group}\n\n| Grid | Seed | Part | Metric | old | new | new/old |\n|---|---:|---|---|---:|---:|---:|\n`;
	for (const row of rows.filter((r) => r.variant !== 'main')) {
		const old = required(
			rows.find((r) => r.raster === row.raster && r.seed === row.seed && r.variant === 'main'),
			"rows.find( (r) => r.raster === row.raster && r.seed === row.seed && r.variant === 'main' )"
		);
		for (const key of keys) {
			const a = Number(old[key as keyof typeof old]),
				b = Number(row[key as keyof typeof row]);
			const f = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '—');
			md += `| ${row.raster} | ${row.seed} | ${row.variant} | ${key} | ${f(a)} | ${f(b)} | ${a ? f(b / a) : '—'} |\n`;
		}
	}
}
const assessments = rows
	.filter((r) => r.variant !== 'main')
	.map((row) => {
		const old = required(
			rows.find((r) => r.raster === row.raster && r.seed === row.seed && r.variant === 'main'),
			"rows.find( (r) => r.raster === row.raster && r.seed === row.seed && r.variant === 'main' )"
		);
		const num = (r: typeof row, k: string) => Number(r[k as keyof typeof r]);
		const m3 =
			num(row, 'tWelt') <= 1.25 * num(old, 'tWelt') && num(row, 'tLage') <= 2 * num(old, 'tLage');
		const netz =
			row.stufe === 0 &&
			row.winkel >= 0.9 * old.winkel &&
			row.seiten <= 1.1 * old.seiten &&
			row.bloecke >= old.bloecke &&
			row.tuerme >= old.tuerme;
		const wege =
			(!['dreieck', 'sechseck', 'viereck', 'voronoi'].includes(row.raster) ||
				row.knick <= 0.7 * old.knick) &&
			row.umweg <= 1.02 * old.umweg &&
			row.hochweg <= 1.05 * old.hochweg &&
			row.ohneAnschluss <= old.ohneAnschluss &&
			row.zusammen &&
			num(row, 'tWege') <= 1.5 * num(old, 'tWege');
		return {
			raster: row.raster,
			seed: row.seed,
			variant: row.variant,
			M3: m3,
			netz,
			wege,
			zugang: row.zugang === 1 && row.dachMax <= 0.05,
			feld:
				row.raster === 'organisch'
					? row.bloecke >= 16 &&
						row.fuellung >= 1.5 * old.fuellung &&
						row.winkel >= 45 &&
						row.seiten <= 2.5 &&
						row.tuerme >= old.tuerme
					: null
		};
	});
md +=
	'\n## Criteria per case\n\n| Grid | Seed | Part | M3 | netz | wege | zugang | feld (without author decision) |\n|---|---:|---|---|---|---|---|---|\n';
for (const a of assessments)
	md += `| ${a.raster} | ${a.seed} | ${a.variant} | ${a.M3} | ${a.netz} | ${a.wege} | ${a.zugang} | ${a.feld ?? '—'} |\n`;
await writeFile(
	dir + 'kennzahlen.json',
	JSON.stringify({ rows, gross, assessments }, null, 2) + '\n'
);
await writeFile(dir + 'kennzahlen.md', md);
// The same report can be refreshed with welt-bericht.ts without measuring again.
await (await import('./welt-bericht')).bericht();
