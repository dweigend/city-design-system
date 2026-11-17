import { editJson, type Sandbox } from './probe-sandbox';

// Gate probe cases: each injects one violation into a sandbox and names the
// output that proves the gate caught exactly that violation.

/** One negative probe: the gate command must fail and print `expect`. */
export type Probe = {
	name: string;
	gate: string[];
	inject: (box: Sandbox) => void;
	/** Commit the injection, so the base ref already contains it (stale, not growth). */
	commit?: boolean;
	/** Format the copy first, so unrelated Prettier noise cannot stop `eslint` from running. */
	formatFirst?: boolean;
	expect: RegExp;
};

const CRUISE_BASELINE = '.dependency-cruiser-baseline.json';
const SUPPRESSIONS = 'eslint-suppressions.json';
const LOGIC_IMPORT =
	"import { STOREY } from '../logic/ansicht/tags';\nexport const probe = STOREY;\n";

function cruiseEntry(from: string, to: string) {
	return { type: 'dependency', from, to, rule: { severity: 'error', name: 'data-no-logic' } };
}

/** Raises the first suppression count by one. */
function bumpSuppression(box: Sandbox): void {
	editJson<Record<string, Record<string, { count: number }>>>(box, SUPPRESSIONS, (value) => {
		const [file] = Object.keys(value);
		const [rule] = Object.keys(value[file]);
		value[file][rule].count += 1;
		return value;
	});
}

/** All gate probes, in verify order. */
export const probes: Probe[] = [
	{
		name: 'lint: prettier',
		gate: ['bun', 'run', 'lint'],
		inject: (box) => box.write('src/lib/probe-format.ts', 'export const probeFormat   =  1\n'),
		expect: /probe-format\.ts/
	},
	{
		name: 'lint: eslint rule',
		gate: ['bun', 'run', 'lint'],
		inject: (box) =>
			box.write(
				'src/lib/probe-lint.ts',
				'export const probeLint = (value?: string) => value!.length;\n'
			),
		formatFirst: true,
		expect: /probe-lint\.ts[\s\S]*no-non-null-assertion/
	},
	{
		name: 'lint: unused eslint suppression',
		gate: ['bun', 'run', 'lint'],
		inject: bumpSuppression,
		commit: true,
		formatFirst: true,
		expect: /There are suppressions left that do not occur anymore/
	},
	{
		name: 'check: type error',
		gate: ['bun', 'run', 'check'],
		inject: (box) =>
			box.write('src/lib/probe-check.ts', "export const probeCheck: number = 'text';\n"),
		expect: /probe-check\.ts/
	},
	{
		name: 'test: failing unit test',
		gate: ['bun', 'run', 'test', 'src/lib/probe-unit.test.ts'],
		inject: (box) =>
			box.write(
				'src/lib/probe-unit.test.ts',
				"import { expect, test } from 'bun:test';\ntest('probe', () => expect(1).toBe(2));\n"
			),
		expect: /probe-unit\.test\.ts[\s\S]*1 fail/
	},
	{
		name: 'boundaries: data imports logic',
		gate: ['bun', 'run', 'check:boundaries'],
		inject: (box) => box.write('src/lib/catalog/data/probe-boundary.ts', LOGIC_IMPORT),
		expect: /data-no-logic[\s\S]*probe-boundary\.ts/
	},
	{
		name: 'fallow: new unused file',
		gate: ['bun', 'run', 'check:fallow'],
		inject: (box) => box.write('src/lib/probe-fallow.ts', 'export const probeFallow = 1;\n'),
		expect: /probe-fallow\.ts/
	},
	{
		name: 'skills: tracked private skill',
		gate: ['bun', 'run', 'check:skills'],
		inject: (box) => {
			box.write('.claude/skills/probe/SKILL.md', '# probe\n');
			box.git(['add', '-f', '.claude/skills/probe/SKILL.md']);
		},
		expect: /\.claude\/skills\/probe\/SKILL\.md/
	},
	{
		name: 'baselines: dependency-cruiser growth',
		gate: ['bun', 'run', 'check:baselines'],
		inject: (box) => {
			const from = 'src/lib/catalog/data/probe-growth.ts';
			box.write(from, LOGIC_IMPORT);
			editJson<unknown[]>(box, CRUISE_BASELINE, (value) => [
				...value,
				cruiseEntry(from, 'src/lib/catalog/logic/ansicht/tags.ts')
			]);
		},
		expect:
			/dependency-cruiser-baseline\.json growth: data-no-logic src\/lib\/catalog\/data\/probe-growth\.ts/
	},
	{
		name: 'baselines: dependency-cruiser stale',
		gate: ['bun', 'run', 'check:baselines'],
		inject: (box) =>
			editJson<unknown[]>(box, CRUISE_BASELINE, (value) => [
				...value,
				cruiseEntry('src/lib/catalog/data/probe-gone.ts', 'src/lib/catalog/logic/ansicht/tags.ts')
			]),
		commit: true,
		expect:
			/dependency-cruiser-baseline\.json stale: data-no-logic src\/lib\/catalog\/data\/probe-gone\.ts/
	},
	{
		name: 'baselines: eslint suppression growth',
		gate: ['bun', 'run', 'check:baselines'],
		inject: bumpSuppression,
		expect: /eslint-suppressions\.json growth: .+: (\d+) -> \d+/
	},
	{
		name: 'baselines: eslint suppression for missing file',
		gate: ['bun', 'run', 'check:baselines'],
		inject: (box) =>
			editJson<Record<string, unknown>>(box, SUPPRESSIONS, (value) => ({
				...value,
				'src/lib/probe-gone.ts': { complexity: { count: 1 } }
			})),
		commit: true,
		expect: /eslint-suppressions\.json stale: src\/lib\/probe-gone\.ts/
	}
];
