// Run: heavy-slot --time 900 -- bun scripts/terrain-study.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { surveyValley, Valley, type ValleyTiming } from '../src/lib/domain/valley';
import { requireSlot } from './experiment-host';

requireSlot();
const out = resolve(import.meta.dir, '../_lokal/r08c-drainage');
mkdirSync(out, { recursive: true });

const reliefs = [0, 0.25, 0.5, 0.75, 1];
const runoffs = [0.5, 1, 1.5];
const seeds = [1201, 1301, 1409, 7, 42, 314, 2718, 9001, 65535, 424242, 31337, 8086];
const inSurvey = ([x, y]: readonly number[]) => Math.max(Math.abs(x), Math.abs(y)) <= 2000;

function reaches(valley: Valley) {
	const byId = new Map(valley.reaches.map((reach) => [reach.id, reach]));
	const trunk: { width: number; length: number }[] = [];
	const tributary = new Map<number, number>();
	let tributaryLengthM = 0;
	let junctionFaults = 0;
	let widthFaults = 0;
	for (const reach of valley.reaches) {
		const downstream = reach.downstream === null ? undefined : byId.get(reach.downstream);
		const last = reach.stations.at(-1);
		if (downstream && last?.water !== downstream.stations[0].water) junctionFaults++;
		let previous = reach.stations[0];
		for (const next of reach.stations.slice(1)) {
			if (Math.abs(next.width - 48 * Math.sqrt(next.discharge)) > 1e-9) widthFaults++;
			const length = Math.hypot(next.xy[0] - previous.xy[0], next.xy[1] - previous.xy[1]);
			if (inSurvey(next.xy) || inSurvey(previous.xy)) {
				if (reach.trunk) trunk.push({ width: (previous.width + next.width) / 2, length });
				else tributaryLengthM += length;
			}
			previous = next;
		}
		if (reach.downstream !== null && last && inSurvey(last.xy)) {
			tributary.set(reach.downstream, (tributary.get(reach.downstream) ?? 0) + 1);
		}
	}
	trunk.sort((a, b) => a.width - b.width);
	const length = trunk.reduce((sum, item) => sum + item.length, 0);
	const percentile = (fraction: number) => {
		let remaining = fraction * length;
		for (const item of trunk) {
			remaining -= item.length;
			if (remaining <= 0) return item.width;
		}
		return trunk.at(-1)?.width ?? 0;
	};
	return {
		trunkWidth: [0.1, 0.5, 0.9].map(percentile),
		tributaryLengthM,
		junctions: [...tributary.values()].filter((count) => count > 1).length,
		junctionFaults,
		widthFaults
	};
}

function lakes(valley: Valley) {
	const trunkLakes = new Set(
		valley.reaches.filter(({ trunk }) => trunk).map(({ downstream }) => downstream)
	);
	return valley.lakes.map((lake) => {
		const complete = lake.rings.length > 0 && lake.rings.every((ring) => ring.every(inSurvey));
		let perimeter = 0;
		for (const ring of lake.rings) {
			for (let i = 0; i < ring.length; i++) {
				const [x, y] = ring[i];
				const [u, v] = ring[(i + 1) % ring.length];
				perimeter += Math.hypot(u - x, v - y);
			}
		}
		return {
			id: lake.id,
			area: lake.area,
			outlet: lake.outlet,
			complete,
			sideLakeWithOutlet: !trunkLakes.has(lake.id) && lake.downstream !== null,
			shape: complete ? perimeter / (2 * Math.sqrt(Math.PI * lake.area)) : null,
			sillFault: lake.level !== lake.sillElevation || lake.area <= 0
		};
	});
}

function run(relief: number, runoff: number, seed: number) {
	const start = performance.now();
	let timing: ValleyTiming | undefined;
	const parameters = { relief, runoff };
	const valley = Valley.create({
		seed,
		parameters,
		onTiming: (result) => {
			timing = result;
		}
	});
	const generationMs = performance.now() - start;
	const again = Valley.create({ seed, parameters });
	const hash = (value: Valley) =>
		Bun.hash(JSON.stringify([value.reaches, value.lakes, value.grid]));
	const survey = surveyValley(valley);
	const drainage = valley.checkDrainage();
	const courses = reaches(valley);
	const bodies = lakes(valley);
	const deterministic = hash(valley) === hash(again);
	const pass =
		deterministic &&
		drainage.areaResidualM2 <= 1e-3 &&
		!drainage.nodeBalanceFaults &&
		!drainage.uphillReceivers &&
		!drainage.carvedSillFaults &&
		drainage.maxDryTriangleSlope <= 0.711 &&
		!courses.widthFaults &&
		!courses.junctionFaults &&
		bodies.every(({ sillFault }) => !sillFault) &&
		survey.faults.lakeTiltM === 0 &&
		survey.faults.uphillSteps === 0 &&
		survey.faults.shoreBelowWater === 0;
	return {
		seed,
		relief,
		runoff,
		generationMs,
		timing,
		survey,
		drainage,
		courses,
		bodies,
		deterministic,
		pass
	};
}

function spread(values: number[]) {
	if (!values.length) return '—';
	const sorted = values.toSorted((a, b) => a - b);
	const median =
		(sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
	return [sorted[0], median, sorted.at(-1)].map((value) => value?.toFixed(3) ?? '—').join('/');
}

const rows = reliefs.flatMap((relief) =>
	runoffs.flatMap((runoff) => seeds.map((seed) => run(relief, runoff, seed)))
);
const failures = rows.filter((row) => !row.pass);
writeFileSync(resolve(out, 'study.json'), JSON.stringify(rows, null, 1));
console.log(`Runs ${rows.length}, passed ${rows.length - failures.length} (min/median/max)`);
for (const relief of reliefs) {
	const group = rows.filter((row) => row.relief === relief);
	const metric = (read: (row: (typeof rows)[number]) => number) => spread(group.map(read));
	const side = group
		.flatMap(({ bodies }) => bodies)
		.filter((body) => body.complete && body.sideLakeWithOutlet);
	const stats = [
		`relief M ${metric(({ survey }) => survey.reliefM)}`,
		`dry slopes ${['p50', 'p95', 'max'].map((key) => metric(({ survey }) => survey.drySlope[key as keyof typeof survey.drySlope])).join(' | ')}`,
		`water ${metric(({ survey }) => survey.waterShare)}`,
		`wet node max grade ${metric(({ survey }) => survey.maxWetSlope)}`,
		`dry below water at shore ${metric(({ survey }) => survey.faults.shoreBelowWater)}`,
		`buildable ${metric(({ survey }) => survey.buildableShare)}`,
		`trunk widths ${[0, 1, 2].map((i) => metric(({ courses }) => courses.trunkWidth[i])).join(' | ')}`,
		`junctions ${metric(({ courses }) => courses.junctions)}`,
		`tributary length m ${metric(({ courses }) => courses.tributaryLengthM)}`,
		`complete side lakes ${side.length}, shoreline shape ${spread(side.flatMap(({ shape }) => (shape === null ? [] : [shape])))}`
	];
	console.log(`relief ${relief} · ${stats.join(' · ')}`);
}
for (const relief of [0, 1]) {
	const warm = rows
		.filter((row) => row.relief === relief && row.runoff === 1)
		.map(({ timing }) => timing);
	console.log(
		`timing relief ${relief}`,
		Object.fromEntries(
			(['baseMs', 'floodMs', 'reachesMs', 'gridMs'] as const).map((key) => [
				key,
				spread(warm.flatMap((timing) => (timing ? [timing[key]] : [])))
			])
		)
	);
}
for (const { relief, runoff, seed, survey, drainage, courses, bodies, deterministic } of failures) {
	console.log(
		'FAIL',
		relief,
		runoff,
		seed,
		survey.faults,
		drainage,
		courses.junctionFaults,
		courses.widthFaults,
		bodies.filter(({ sillFault }) => sillFault).map(({ id }) => id),
		deterministic
	);
}
if (failures.length) process.exitCode = 1;
