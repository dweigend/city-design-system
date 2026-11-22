import { expect, test } from 'bun:test';
import { blockInputs } from '../data/block-inputs';
import { readContractDocs } from './contract-docs';

const fields = [
	'Purpose: Validates the input.',
	'Exports: validate',
	'Outputs: Detached result.',
	'Input: seed | number | — | Unsigned 32-bit integer | Required'
].join('\n');

const example = '# Demo\n\nKind: example\nSubject: sample\n' + fields;
const sources = {
	sample: '# Sample\n\nKind: block\nExample: demo\nShared inputs: height\n' + fields,
	demo: example
};

test('reads declared rows and takes shared input metadata from its schema', () => {
	const docs = readContractDocs(sources, blockInputs, new Set(['demo']));
	const sample = docs.find(({ key }) => key === 'sample');
	expect(sample?.example).toBe('demo');
	expect(sample?.importLine).toContain("from '#lib/catalog/sample/index.ts'");
	expect(sample?.inputs).toEqual([
		{
			name: 'seed',
			type: 'number',
			unit: '—',
			range: 'Unsigned 32-bit integer',
			defaultValue: 'Required'
		},
		{
			name: 'height',
			type: blockInputs.height.type,
			unit: blockInputs.height.unit,
			range: `${blockInputs.height.min}–${blockInputs.height.max}`,
			defaultValue: String(blockInputs.height.default),
			shared: true
		}
	]);
});

test.each([
	['# Sample\n\n' + fields, 'missing Kind'],
	[sources.sample.replace('Kind: block', 'Kind: block\nKind: recipe'), 'duplicate Kind'],
	[sources.sample.replace('Kind: block', 'Kind: unknown'), 'unknown Kind'],
	[sources.sample.replace('Example: demo\n', ''), 'missing Example'],
	[
		sources.sample.replace('Example: demo', 'Example: missing'),
		'unresolved public example missing'
	],
	[
		sources.sample.replace('Example: demo', 'Example: demo/private.ts'),
		'unresolved public example'
	],
	[
		sources.sample.replace('Shared inputs: height', 'Shared inputs: private'),
		'unknown shared input'
	]
])('rejects invalid metadata (%s)', (sample, message) => {
	expect(() => readContractDocs({ sample, demo: example }, blockInputs, new Set(['demo']))).toThrow(
		message
	);
});

test('rejects an example contract without a public viewer binding', () => {
	expect(() => readContractDocs(sources, blockInputs, new Set())).toThrow('example demo');
});

test('rejects an example declared for another subject', () => {
	const wrong = example.replace('Subject: sample', 'Subject: other');
	expect(() =>
		readContractDocs({ ...sources, demo: wrong }, blockInputs, new Set(['demo']))
	).toThrow('belongs to another subject');
});
