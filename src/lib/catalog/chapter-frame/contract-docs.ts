const kinds = [
	'block',
	'recipe',
	'example',
	'core',
	'core-type',
	'data',
	'scene-contract',
	'projection',
	'stage',
	'host'
] as const;

export const docKinds = ['block', 'recipe', 'example'] as const;
type Kind = (typeof kinds)[number];
type DocKind = (typeof docKinds)[number];

export type DocInput = Readonly<{
	name: string;
	type: string;
	unit: string;
	range: string;
	defaultValue: string;
	shared?: true;
}>;

type SharedSchema = Readonly<
	Record<
		string,
		Readonly<{ type: string; unit: string; min: number; max: number; default: number }>
	>
>;

export type ContractDoc = Readonly<{
	key: string;
	slug: string;
	title: string;
	kind: DocKind;
	purpose: string;
	importLine: string;
	inputs: readonly DocInput[];
	outputs: string;
	example?: string;
}>;

type Header = { key: string; title: string; kind: Kind; fields: ReadonlyMap<string, string[]> };
type Sources = Readonly<Record<string, string>>;
const moduleKey = /^[a-z][a-z\d-]*(?:\/[a-z][a-z\d-]*)?$/;

function fail(key: string, message: string): never {
	throw new Error(`${key}/CONTRACT.md: ${message}`);
}

type Fields = Pick<Header, 'key' | 'fields'>;

function single(header: Fields, field: string, required?: true): string;
function single(header: Fields, field: string, required: boolean): string | undefined;
function single({ key, fields }: Fields, field: string, required = true): string | undefined {
	const values = fields.get(field);
	if (values && values.length !== 1) fail(key, `duplicate ${field}`);
	if (!values?.[0] && required) fail(key, `missing ${field}`);
	return values?.[0];
}

function readHeader(key: string, markdown: string): Header {
	const [heading, metadata] = markdown.trim().split(/\r?\n\s*\r?\n/, 2);
	if (!heading.startsWith('# ')) fail(key, 'missing title');
	const fields = new Map<string, string[]>();
	for (const line of metadata?.split(/\r?\n/) ?? []) {
		const match = /^([A-Z][a-zA-Z ]*):\s*(.*)$/.exec(line);
		if (!match) continue;
		const [, field, value] = match;
		const values = fields.get(field) ?? [];
		values.push(value.trim());
		fields.set(field, values);
	}
	const header = { key, title: heading.slice(2).trim(), fields };
	const declared = single(header, 'Kind');
	const kind = kinds.find((entry) => entry === declared);
	if (!kind) fail(key, 'unknown Kind');
	return { ...header, kind };
}

function declaredInput(key: string, row: string): DocInput {
	const [name, type, unit, range, defaultValue, extra] = row.split('|').map((cell) => cell.trim());
	if (!name || !type || !unit || !range || !defaultValue || extra !== undefined)
		fail(key, `invalid Input: ${row}`);
	return { name, type, unit, range, defaultValue };
}

function sharedInput(key: string, name: string, schema: SharedSchema): DocInput {
	if (!Object.hasOwn(schema, name)) fail(key, `unknown shared input ${name}`);
	const { type, unit, min, max, default: value } = schema[name];
	return {
		name,
		type,
		unit: unit || '—',
		range: `${min}–${max}`,
		defaultValue: String(value),
		shared: true
	};
}

function readDoc(
	header: Header,
	kind: DocKind,
	schema: SharedSchema,
	example?: string
): ContractDoc {
	const { key, title, fields } = header;
	const inputs = (fields.get('Input') ?? []).map((row) => declaredInput(key, row));
	const shared = single(header, 'Shared inputs', false);
	for (const name of shared?.split(',').map((name) => name.trim()) ?? [])
		inputs.push(sharedInput(key, name, schema));
	if (new Set(inputs.map(({ name }) => name)).size !== inputs.length) fail(key, 'duplicate input');
	const exports = single(header, 'Exports');
	if (!/^[$\w]+(?:,\s*[$\w]+)*$/.test(exports)) fail(key, 'invalid Exports');
	return {
		key,
		slug: key.slice(key.lastIndexOf('/') + 1),
		title,
		kind,
		purpose: single(header, 'Purpose'),
		importLine: `import { ${exports} } from '#lib/catalog/${key}/index.ts'`,
		inputs,
		outputs: single(header, 'Outputs'),
		example
	};
}

function resolveExample(
	header: Header,
	headers: ReadonlyMap<string, Header>,
	publicExamples: ReadonlySet<string>
): string | undefined {
	const { key, kind } = header;
	const example = single(header, 'Example', kind === 'block');
	if (!example) return;
	const target = headers.get(example);
	if (!moduleKey.test(example) || !publicExamples.has(example) || target?.kind !== 'example')
		fail(key, `unresolved public example ${example}`);
	if (single(target, 'Subject') !== key) fail(key, `example ${example} belongs to another subject`);
	return example;
}

/** Reads detached docs from raw public contracts. Throws for invalid metadata, ambiguous slugs or
 * examples without a public viewer binding. Reads no files and leaves the supplied schema untouched.
 */
export function readContractDocs(
	sources: Sources,
	schema: SharedSchema,
	publicExamples: ReadonlySet<string>
): ContractDoc[] {
	const headers = new Map(
		Object.entries(sources).map(([key, text]) => [key, readHeader(key, text)])
	);
	const docs: ContractDoc[] = [];
	const slugs = new Set<string>();
	for (const header of headers.values()) {
		const kind = docKinds.find((entry) => header.kind === entry);
		if (!kind) continue;
		if (!moduleKey.test(header.key)) fail(header.key, 'invalid public module key');
		if (kind === 'example' && !publicExamples.has(header.key))
			fail(header.key, 'missing public viewer binding');
		const example = resolveExample(header, headers, publicExamples);
		const doc = readDoc(header, kind, schema, example);
		if (slugs.has(doc.slug)) fail(header.key, `duplicate public slug ${doc.slug}`);
		slugs.add(doc.slug);
		docs.push(doc);
	}
	return docs.sort((a, b) => a.title.localeCompare(b.title, 'en'));
}
